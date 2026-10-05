import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { packager } from "@electron/packager";
import { z } from "zod";

if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("This packaging command is verified for Windows x64 only.");
const metadata = z
  .object({
    version: z.string(),
    devDependencies: z.object({ electron: z.string() }),
  })
  .parse(JSON.parse(await readFile("package.json", "utf8")));
const stamp = new Date().toISOString().replaceAll(/[^0-9]/g, "");
const outputs = await packager({
  dir: resolve("."),
  out: resolve("release", `windows-${stamp}`),
  name: "TommyBrown",
  executableName: "TommyBrown",
  appBundleId: "com.tommybrown.desktop",
  appVersion: metadata.version,
  electronVersion: metadata.devDependencies.electron,
  platform: "win32",
  arch: "x64",
  asar: false,
  prune: true,
  overwrite: false,
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
for (const directory of outputs)
  console.log(resolve(directory, "TommyBrown.exe"));
