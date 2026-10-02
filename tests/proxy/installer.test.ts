import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  extractVerifiedExecutable,
  releaseFor,
} from "../../src/main/proxy/installer";

describe("upstream binary verification", () => {
  const archive = zipSync({
    "cli-proxy-api.exe": strToU8("verified executable"),
    "../outside": strToU8("unsafe"),
  });
  const checksum = createHash("sha256").update(archive).digest("hex");

  it("pins a version and architecture-specific upstream checksum", () => {
    const release = releaseFor("x64");
    expect(release.url).toContain(
      "/v8.0.10/CLIProxyAPI_8.0.10_windows_amd64.zip",
    );
    expect(release.sha256).toBe(
      "d73c3b78faeb9d4c6e80890f0242146557a5032dfbb788474d06cdb64544b325",
    );
    expect(releaseFor("arm64").sha256).not.toBe(release.sha256);
    expect(() => releaseFor("ia32")).toThrow(/architecture/i);
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
