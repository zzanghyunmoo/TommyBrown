import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import ky from "ky";
import { z } from "zod";
import { GatewayError } from "../../shared/proxy";

export const PROXY_VERSION = "8.0.10";
const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;
const MAX_EXECUTABLE_BYTES = 300 * 1024 * 1024;
const releases = {
  x64: {
    arch: "amd64",
    sha256: "d73c3b78faeb9d4c6e80890f0242146557a5032dfbb788474d06cdb64544b325",
  },
  arm64: {
    arch: "aarch64",
    sha256: "fb8d120664f85dc91bfcea056d8995486e90f9b0d5d18ddcee6ad0053957f62c",
  },
} as const;

export function releaseFor(architecture: string) {
  if (architecture !== "x64" && architecture !== "arm64")
    throw new GatewayError("download", "Unsupported Windows architecture.");
  const release = releases[architecture];
  return {
    url: `https://github.com/router-for-me/CLIProxyAPI/releases/download/v${PROXY_VERSION}/CLIProxyAPI_${PROXY_VERSION}_windows_${release.arch}.zip`,
    sha256: release.sha256,
  };
}

export function extractVerifiedExecutable(
  archive: Uint8Array,
  sha256: string,
): Uint8Array {
  if (
    archive.byteLength > MAX_ARCHIVE_BYTES ||
    createHash("sha256").update(archive).digest("hex") !== sha256
  ) {
    throw new GatewayError(
      "integrity",
      "CLIProxyAPI archive checksum verification failed.",
    );
  }
  const entries = unzipSync(archive, {
    filter: (entry) =>
      entry.name === "cli-proxy-api.exe" &&
      entry.originalSize <= MAX_EXECUTABLE_BYTES,
  });
  const executables = Object.values(entries);
  const executable = executables[0];
  if (executables.length !== 1 || !executable?.length)
    throw new GatewayError(
      "integrity",
      "The release archive has no valid gateway executable.",
    );
  return executable;
}

const installationSchema = z.object({
  version: z.literal(PROXY_VERSION),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export class ProxyInstaller {
  readonly executable: string;
  private readonly receipt: string;
  private installation: Promise<string> | undefined;

  constructor(private readonly directory: string) {
    this.executable = join(directory, "CLIProxyAPI.exe");
    this.receipt = join(directory, "installation.json");
  }

  async isInstalled(): Promise<boolean> {
    try {
      const receipt = installationSchema.safeParse(
        JSON.parse(await readFile(this.receipt, "utf8")),
      );
      if (!receipt.success) return false;
      const binary = await readFile(this.executable);
      return (
        createHash("sha256").update(binary).digest("hex") ===
        receipt.data.sha256
      );
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        return false;
      throw error;
    }
  }

  install(): Promise<string> {
    if (this.installation) return this.installation;
    this.installation = this.download().finally(() => {
      this.installation = undefined;
    });
    return this.installation;
  }

  private async download(): Promise<string> {
    if (process.platform !== "win32")
      throw new GatewayError(
        "download",
        "Managed engine installation currently supports Windows.",
      );
    if (await this.isInstalled()) return this.executable;
    const release = releaseFor(process.arch);
    const response = await ky.get(release.url, {
      timeout: 120_000,
      signal: AbortSignal.timeout(120_000),
      retry: 1,
    });
    const reader = response.body?.getReader();
    if (!reader)
      throw new GatewayError(
        "download",
        "The release download returned no body.",
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.length;
        if (size > MAX_ARCHIVE_BYTES)
          throw new GatewayError(
            "download",
            "The release archive exceeds the download size limit.",
          );
        chunks.push(result.value);
      }
    } finally {
      await reader.cancel();
    }
    const executable = extractVerifiedExecutable(
      Buffer.concat(chunks),
      release.sha256,
    );
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.executable}.download`;
    await writeFile(temporary, executable, { mode: 0o700 });
    await rename(temporary, this.executable);
    await writeFile(
      this.receipt,
      JSON.stringify({
        version: PROXY_VERSION,
        sha256: createHash("sha256").update(executable).digest("hex"),
      }),
      { mode: 0o600 },
    );
    return this.executable;
  }
}
