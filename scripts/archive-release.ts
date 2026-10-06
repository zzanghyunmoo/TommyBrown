import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const metadata = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    platform: z.enum(["win32", "darwin"]),
    arch: z.enum(["x64", "arm64"]),
    directory: z.string(),
  })
  .parse(JSON.parse(await readFile("release/package.json", "utf8")));
if (metadata.platform !== process.platform || metadata.arch !== process.arch)
  throw new Error("Archive the package on its native build host.");
const platform = metadata.platform === "win32" ? "windows" : "macos";
const name = `TommyBrown-${metadata.version}-${platform}-${metadata.arch}.zip`;
const out = resolve("release", "assets");
await mkdir(out, { recursive: true });
const execute = promisify(execFile);
const destination = join(out, name);
if (metadata.platform === "darwin") {
  await execute(
    "ditto",
    [
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      join(metadata.directory, "TommyBrown.app"),
      destination,
    ],
    { timeout: 300_000 },
  );
} else {
  await execute(
    join(
      z.string().min(1).parse(process.env["SystemRoot"]),
      "System32",
      "tar.exe",
    ),
    [
      "-a",
      "-c",
      "-f",
      destination,
      "-C",
      dirname(metadata.directory),
      basename(metadata.directory),
    ],
    { timeout: 300_000 },
  );
}
const hash = createHash("sha256")
  .update(await readFile(destination))
  .digest("hex");
await writeFile(`${destination}.sha256`, `${hash}  ${name}\n`);
console.log(name);
