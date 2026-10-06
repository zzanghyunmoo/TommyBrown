import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { packager } from "@electron/packager";
import { z } from "zod";
import "./prepare-native";

const platform = z.enum(["win32", "darwin"]).parse(process.platform);
const arch = z.enum(["x64", "arm64"]).parse(process.arch);
if (platform === "win32" && arch !== "x64")
  throw new Error("The Windows release supports x64.");
const metadata = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    devDependencies: z.object({ electron: z.string() }),
  })
  .parse(JSON.parse(await readFile("package.json", "utf8")));
const stamp = new Date().toISOString().replaceAll(/[^0-9]/g, "");
const outputs = await packager({
  dir: resolve("."),
  out: resolve(
    "release",
    `${platform === "win32" ? "windows" : "macos"}-${stamp}`,
  ),
  name: "TommyBrown",
  executableName: "TommyBrown",
  appBundleId: "com.tommybrown.desktop",
  appVersion: metadata.version,
  electronVersion: metadata.devDependencies.electron,
  platform,
  arch,
  asar: false,
  prune: true,
  overwrite: false,
  darwinDarkModeSupport: true,
  ignore: (path) => {
    const local = path.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!local) return false;
    return !["dist", "node_modules", "package.json"].some(
      (name) => local === name || local.startsWith(`${name}/`),
    );
  },
  win32metadata: {
    CompanyName: "TommyBrown contributors",
    ProductName: "TommyBrown",
    FileDescription: "TommyBrown desktop workspace",
    InternalName: "TommyBrown",
  },
});
const directory = outputs[0];
if (outputs.length !== 1 || !directory)
  throw new Error("Expected exactly one native package.");
if (platform === "darwin") {
  const execute = promisify(execFile);
  const app = join(directory, "TommyBrown.app");
  await execute("codesign", ["--force", "--deep", "--sign", "-", app], {
    timeout: 120_000,
  });
  await execute("codesign", ["--verify", "--deep", "--strict", app], {
    timeout: 30_000,
  });
}
const executable =
  platform === "win32"
    ? join(directory, "TommyBrown.exe")
    : join(directory, "TommyBrown.app", "Contents", "MacOS", "TommyBrown");
await writeFile(
  "release/package.json",
  JSON.stringify(
    { version: metadata.version, platform, arch, directory, executable },
    null,
    2,
  ),
);
console.log(executable);
