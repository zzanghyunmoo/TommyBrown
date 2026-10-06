import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { posixLaunch } from "../../src/main/terminal/posix";
import { shellProfile } from "../../src/main/terminal/shell-profile";
import { defaultLaunchSettings } from "../../src/shared/launch-settings";

afterEach(() => vi.unstubAllEnvs());

function execute(
  args: readonly string[],
  environment: Readonly<Record<string, string | null>>,
  input: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries({
      ...process.env,
      ...environment,
    }))
      if (value !== undefined && value !== null) env[key] = value;
    const child = spawn("/bin/bash", [...args], { env });
    let output = "";
    let errors = "";
    child.stdout.on("data", (bytes: Buffer) => {
      output += bytes.toString();
    });
    child.stderr.on("data", (bytes: Buffer) => {
      errors += bytes.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(errors)),
    );
    child.stdin.end(input);
  });
}

it.skipIf(process.platform !== "darwin")(
  "passes literal model and MCP arguments through all Bash CLI functions",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "tb-shell-"));
    try {
      for (const name of ["claude", "codex", "agy"]) {
        const file = join(directory, name);
        await writeFile(
          file,
          '#!/bin/bash\nprintf \'<%s>\\n\' "$TB_TEST" "$@"\n',
        );
        await chmod(file, 0o700);
      }
      vi.stubEnv("PATH", `${directory}:${process.env["PATH"] ?? ""}`);
      const profile = await shellProfile(
        {
          launchProfile: async () => ({
            executable: "fixture",
            args: ["--model", "literal'$(printf BAD)"],
            environment: { TB_TEST: "session value" },
          }),
        },
        {
          ...defaultLaunchSettings(),
          models: { claude: "fable", codex: "astra", antigravity: "argon" },
        },
        {
          profile: () => ({
            args: ["--mcp-config", "folder with spaces/config.json"],
            environment: {},
          }),
          revoke: () => undefined,
          dispose: async () => undefined,
        },
      );
      const output = await execute(
        profile.args,
        profile.environment,
        "claude extra\ncodex extra\nagy extra\nantigravity extra\nexit\n",
      );
      expect(output.match(/<session value>/g)).toHaveLength(4);
      expect(output.match(/<literal'\$\(printf BAD\)>/g)).toHaveLength(4);
      expect(output.match(/<folder with spaces\/config.json>/g)).toHaveLength(
        4,
      );
      expect(output.match(/<extra>/g)).toHaveLength(4);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it.skipIf(process.platform !== "darwin")(
  "isolates copied shell environments and keeps metacharacters literal",
  async () => {
    const command = posixLaunch({
      executable: "/usr/bin/printenv",
      args: ["TB_TEST"],
      environment: { TB_TEST: "key'$(printf BAD)", TB_REMOVE: null },
    });
    const output = await execute(
      [
        "--noprofile",
        "--norc",
        "-c",
        `${command}\nprintf '<%s:%s>' "$TB_TEST" "$TB_REMOVE"`,
      ],
      { TB_TEST: "previous", TB_REMOVE: "retained" },
      "",
    );
    expect(output).toBe("key'$(printf BAD)\n<previous:retained>");
  },
);
