import { readFile, stat } from "node:fs/promises";
import { delimiter, dirname, extname, join } from "node:path";
import { z } from "zod";

async function executableOnPath(name: string): Promise<string> {
  const path =
    Object.entries(process.env).find(
      ([key]) => key.toLowerCase() === "path",
    )?.[1] ?? "";
  for (const directory of path.split(delimiter).filter(Boolean)) {
    for (const extension of [".exe", ".com", ".cmd", ".bat"]) {
      const candidate = join(
        directory.replace(/^"|"$/g, ""),
        `${name}${extension}`,
      );
      try {
        if ((await stat(candidate)).isFile()) return candidate;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          !["ENOENT", "ENOTDIR"].includes(String(error.code))
        )
          throw error;
      }
    }
  }
  throw new Error(
    `${name} was not found on PATH. Install the CLI before opening a session.`,
  );
}

export async function resolveCli(name: "claude" | "codex") {
  const path = await executableOnPath(name);
  if ([".exe", ".com"].includes(extname(path).toLowerCase()))
    return { executable: path, args: [] };
  const packageName =
    name === "codex" ? "@openai/codex" : "@anthropic-ai/claude-code";
  let entry: string | undefined;
  for (const directory of [
    join(dirname(path), "node_modules", packageName),
    join(dirname(path), "..", packageName),
  ]) {
    try {
      const manifest = z
        .object({
          bin: z.union([z.string(), z.record(z.string(), z.string())]),
        })
        .parse(
          JSON.parse(await readFile(join(directory, "package.json"), "utf8")),
        );
      const bin =
        typeof manifest.bin === "string" ? manifest.bin : manifest.bin[name];
      if (bin && (await stat(join(directory, bin))).isFile()) {
        entry = join(directory, bin);
        break;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
    }
  }
  if (!entry)
    throw new Error(
      `${name} uses an unsupported shell wrapper. Install the native CLI or its standard npm package.`,
    );
  const node = await executableOnPath("node");
  if (![".exe", ".com"].includes(extname(node).toLowerCase()))
    throw new Error(
      "A native Node.js installation is required to run this CLI.",
    );
  return { executable: node, args: [entry] };
}
