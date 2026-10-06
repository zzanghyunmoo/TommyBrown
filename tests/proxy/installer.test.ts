import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { create } from "tar";
import { describe, expect, it } from "vitest";
import {
  extractVerifiedExecutable,
  extractVerifiedTarExecutable,
  releaseFor,
} from "../../src/main/proxy/installer";

describe("upstream binary verification", () => {
  const archive = zipSync({
    "cli-proxy-api.exe": strToU8("verified executable"),
    "../outside": strToU8("unsafe"),
  });
  const checksum = createHash("sha256").update(archive).digest("hex");

  it("pins a version and architecture-specific upstream checksum", () => {
    const release = releaseFor("x64", "win32");
    expect(release.url).toContain(
      "/v8.0.10/CLIProxyAPI_8.0.10_windows_amd64.zip",
    );
    expect(release.sha256).toBe(
      "d73c3b78faeb9d4c6e80890f0242146557a5032dfbb788474d06cdb64544b325",
    );
    expect(releaseFor("arm64", "win32").sha256).not.toBe(release.sha256);
    expect(() => releaseFor("ia32", "win32")).toThrow(/architecture/i);
  });

  it("pins independent Apple Silicon and Intel Darwin archives", () => {
    expect(releaseFor("arm64", "darwin")).toMatchObject({
      url: expect.stringContaining("darwin_aarch64.tar.gz"),
      sha256:
        "e2080f54ee4d7940c77345440956ce592eef34da2910bd865d4928b75accd122",
    });
    expect(releaseFor("x64", "darwin")).toMatchObject({
      url: expect.stringContaining("darwin_amd64.tar.gz"),
      sha256:
        "2d5af1cf19cc0d887b96fde809f78a999438a65564ce19de5966b7d5b6c451ca",
    });
    expect(() => releaseFor("x64", "linux")).toThrow(/platform/i);
  });

  it("reads only the exact executable from a verified Darwin tar archive", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tb-tar-"));
    try {
      await writeFile(join(directory, "cli-proxy-api"), "darwin executable");
      await writeFile(join(directory, "other"), "not executable");
      const archive = await create({ cwd: directory, gzip: true }, [
        "cli-proxy-api",
        "other",
      ]).concat();
      const hash = createHash("sha256").update(archive).digest("hex");
      expect(
        Buffer.from(
          await extractVerifiedTarExecutable(archive, hash),
        ).toString(),
      ).toBe("darwin executable");
      await expect(
        extractVerifiedTarExecutable(archive, "0".repeat(64)),
      ).rejects.toThrow(/checksum/i);
      const missing = await create({ cwd: directory, gzip: true }, [
        "other",
      ]).concat();
      await expect(
        extractVerifiedTarExecutable(
          missing,
          createHash("sha256").update(missing).digest("hex"),
        ),
      ).rejects.toThrow(/executable/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("extracts only the executable and never writes archive paths", () => {
    expect(
      Buffer.from(extractVerifiedExecutable(archive, checksum)).toString(),
    ).toBe("verified executable");
  });

  it("refuses corrupted bytes and archives without the exact executable", () => {
    expect(() => extractVerifiedExecutable(archive, "0".repeat(64))).toThrow(
      /checksum/i,
    );
    const empty = zipSync({
      "elsewhere/cli-proxy-api.exe": strToU8("wrong entry"),
    });
    expect(() =>
      extractVerifiedExecutable(
        empty,
        createHash("sha256").update(empty).digest("hex"),
      ),
    ).toThrow(/executable/i);
  });
});
