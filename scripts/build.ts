import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";

await Promise.all([
  bundle({
    entryPoints: [
      "node_modules/@modelcontextprotocol/server-memory/dist/index.js",
    ],
    outfile: "dist/main/memory.cjs",
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    define: { "import.meta.url": "__memoryModuleUrl" },
    banner: {
      js: "const __memoryModuleUrl = require('node:url').pathToFileURL(__filename).href;",
    },
  }),
  bundle({
    entryPoints: ["src/main/index.ts"],
    outfile: "dist/main/index.cjs",
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    external: ["electron", "node-pty"],
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
