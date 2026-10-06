import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const metadata = z
  .object({ executable: z.string() })
  .parse(JSON.parse(await readFile("release/package.json", "utf8")));
const child = spawn(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/desktop/agent-installation.e2e.ts",
    "tests/desktop/agent-installation-live.e2e.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, TOMMYBROWN_PACKAGED_APP: metadata.executable },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
