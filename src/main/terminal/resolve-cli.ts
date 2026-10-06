import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, extname, join } from "node:path";
import { z } from "zod";
import { desktopPath } from "./posix";

export class CliNotFoundError extends Error {
  constructor(readonly command: string) {
    super(
      `${command} was not found on PATH. Install the CLI before opening a session.`,
    );
  }
}

export function nativeCliDirectories(): string[] {
  const local = process.env["LOCALAPPDATA"];
  return [
    join(homedir(), ".local", "bin"),
    ...(local
      ? [
          join(local, "Programs", "OpenAI", "Codex", "bin"),
          join(local, "agy", "bin"),
        ]
      : []),
  ];
}

async function executableOnPath(
  name: string,
  fallback: readonly string[] = [],
): Promise<string> {
  const path =
    process.platform === "darwin"
      ? desktopPath()
      : (Object.entries(process.env).find(
          ([key]) => key.toLowerCase() === "path",
        )?.[1] ?? "");
  for (const directory of [
    ...path.split(delimiter).filter(Boolean),
    ...fallback,
  ]) {
    for (const extension of process.platform === "win32"
      ? [".exe", ".com", ".cmd", ".bat"]
      : [""]) {
      const candidate = join(
        directory.replace(/^"|"$/g, ""),
        `${name}${extension}`,
      );
      try {
        if ((await stat(candidate)).isFile()) {
          if (process.platform !== "win32")
            await access(candidate, constants.X_OK);
          return candidate;
        }
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          !["ENOENT", "ENOTDIR", "EACCES"].includes(String(error.code))
        )
          throw error;
      }
    }
  }
  throw new CliNotFoundError(name);
}

export async function resolveCli(cli: "claude" | "codex" | "antigravity") {
  if (process.platform !== "win32")
    return {
      executable: await executableOnPath(cli === "antigravity" ? "agy" : cli),
      args: [],
    };
  if (cli === "antigravity") {
    const local = process.env["LOCALAPPDATA"];
    const path = await executableOnPath(
      "agy",
      local ? [join(local, "agy", "bin")] : [],
    );
    if (![".exe", ".com"].includes(extname(path).toLowerCase()))
      throw new Error(
        "Install the native Antigravity CLI (agy.exe) before opening a session.",
      );
    return { executable: path, args: [] };
  }
  const name = cli;
  const path = await executableOnPath(name, nativeCliDirectories());
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
