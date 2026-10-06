import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { probeAgent } from "../../src/main/agents/installer";

it.skipIf(process.platform !== "win32")(
  "does not classify a standard npm CLI without Node as missing",
  async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "tommybrown-cli-resolution-"),
    );
    const packageDirectory = join(
      directory,
      "node_modules",
      "@openai",
      "codex",
    );
    try {
      await mkdir(packageDirectory, { recursive: true });
      await writeFile(join(directory, "codex.cmd"), "@node cli.js\r\n");
      await writeFile(
        join(packageDirectory, "package.json"),
        JSON.stringify({ bin: { codex: "cli.js" } }),
      );
      await writeFile(
        join(packageDirectory, "cli.js"),
        "console.log('fixture')",
      );
      const pathKey =
        Object.keys(process.env).find((key) => key.toLowerCase() === "path") ??
        "PATH";
      vi.stubEnv(pathKey, directory);
      await expect(
        probeAgent("codex", new AbortController().signal),
      ).rejects.toThrow("node was not found");
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
