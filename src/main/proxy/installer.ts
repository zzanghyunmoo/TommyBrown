import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import ky from "ky";
import { Parser } from "tar";
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

const darwinChecksums = {
  x64: "2d5af1cf19cc0d887b96fde809f78a999438a65564ce19de5966b7d5b6c451ca",
  arm64: "e2080f54ee4d7940c77345440956ce592eef34da2910bd865d4928b75accd122",
} as const;

export function releaseFor(
  architecture: string,
  platform: string = process.platform,
) {
  if (platform !== "win32" && platform !== "darwin")
    throw new GatewayError("download", "Unsupported desktop platform.");
  if (architecture !== "x64" && architecture !== "arm64")
    throw new GatewayError("download", "Unsupported desktop architecture.");
  const release = releases[architecture];
  const target = platform === "win32" ? "windows" : "darwin";
  const extension = platform === "win32" ? "zip" : "tar.gz";
  return {
    url: `https://github.com/router-for-me/CLIProxyAPI/releases/download/v${PROXY_VERSION}/CLIProxyAPI_${PROXY_VERSION}_${target}_${release.arch}.${extension}`,
    sha256:
      platform === "win32" ? release.sha256 : darwinChecksums[architecture],
  };
}

function verifyArchive(archive: Uint8Array, sha256: string): void {
  if (
    archive.byteLength > MAX_ARCHIVE_BYTES ||
    createHash("sha256").update(archive).digest("hex") !== sha256
  ) {
    throw new GatewayError(
      "integrity",
      "CLIProxyAPI archive checksum verification failed.",
    );
  }
}

export function extractVerifiedExecutable(
  archive: Uint8Array,
  sha256: string,
): Uint8Array {
  verifyArchive(archive, sha256);
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

export async function extractVerifiedTarExecutable(
  archive: Uint8Array,
  sha256: string,
): Promise<Uint8Array> {
  verifyArchive(archive, sha256);
  const bytes = gunzipSync(archive, { maxOutputLength: MAX_EXECUTABLE_BYTES });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let matches = 0;
    const parser = new Parser({
      strict: true,
      onReadEntry: (entry) => {
        if (
          entry.path === "cli-proxy-api" &&
          entry.type === "File" &&
          entry.size > 0 &&
          entry.size <= MAX_EXECUTABLE_BYTES
        ) {
          matches++;
          entry.on("data", (chunk: Buffer) => chunks.push(chunk));
        } else entry.resume();
      },
    });
    parser.on("error", reject);
    parser.on("end", () => {
      if (matches !== 1 || chunks.length === 0)
        reject(
          new GatewayError(
            "integrity",
            "The release archive has no valid gateway executable.",
          ),
        );
      else resolve(Buffer.concat(chunks));
    });
    parser.end(bytes);
  });
}

const installationSchema = z.object({
  version: z.literal(PROXY_VERSION),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  platform: z.string().optional(),
  architecture: z.string().optional(),
});

export class ProxyInstaller {
  readonly executable: string;
  private readonly receipt: string;
  private installation: Promise<string> | undefined;

  constructor(private readonly directory: string) {
    this.executable = join(
      directory,
      process.platform === "win32" ? "CLIProxyAPI.exe" : "CLIProxyAPI",
    );
    this.receipt = join(directory, "installation.json");
  }

  async isInstalled(): Promise<boolean> {
    try {
      const receipt = installationSchema.safeParse(
        JSON.parse(await readFile(this.receipt, "utf8")),
      );
      if (!receipt.success) return false;
      if (
        receipt.data.platform !== undefined &&
        receipt.data.platform !== process.platform
      )
        return false;
      if (
        receipt.data.architecture !== undefined &&
        receipt.data.architecture !== process.arch
      )
        return false;
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
    const release = releaseFor(process.arch);
    if (await this.isInstalled()) return this.executable;
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
    const executable = await (process.platform === "win32"
      ? extractVerifiedExecutable
      : extractVerifiedTarExecutable)(Buffer.concat(chunks), release.sha256);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.executable}.download`;
    await writeFile(temporary, executable, { mode: 0o700 });
    await rename(temporary, this.executable);
    await writeFile(
      this.receipt,
      JSON.stringify({
        version: PROXY_VERSION,
        platform: process.platform,
        architecture: process.arch,
        sha256: createHash("sha256").update(executable).digest("hex"),
      }),
      { mode: 0o600 },
    );
    return this.executable;
  }
}
