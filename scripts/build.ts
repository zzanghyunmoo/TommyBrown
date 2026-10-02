import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";

await Promise.all([
  bundle({
    entryPoints: ["src/main/index.ts"],
    outfile: "dist/main/index.cjs",
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    external: ["electron"],
  }),
  bundle({
    entryPoints: ["src/preload/index.ts"],
    outfile: "dist/preload/index.cjs",
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    external: ["electron"],
  }),
  viteBuild({
    root: "src/renderer",
    base: "./",
    build: { outDir: "../../dist/renderer", emptyOutDir: true },
  }),
]);
