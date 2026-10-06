import { homedir } from "node:os";
import { join } from "node:path";
import type { LaunchProfile } from "../../shared/launch";

export const quotePosix = (value: string): string =>
  `'${value.replaceAll("'", "'\"'\"'")}'`;

export function desktopPath(): string {
  return [
    ...new Set(
      [
        ...(process.env["PATH"] ?? "").split(":"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        join(homedir(), ".local", "bin"),
        join(homedir(), ".bun", "bin"),
        join(homedir(), ".agy", "bin"),
      ].filter(Boolean),
    ),
  ].join(":");
}

export function bashProfile(
  environment: LaunchProfile["environment"] = {},
  commands: readonly string[] = [],
): LaunchProfile {
  return {
    executable: "/bin/bash",
    args: [
      "--noprofile",
      "--norc",
      "-c",
      [...commands, "exec /bin/bash --noprofile --norc -i"].join("\n"),
    ],
    environment: {
      PATH: desktopPath(),
      PS1: "\\[\\e[36m\\]\\w\\[\\e[0m\\] > ",
      ...environment,
    },
  };
}

export function posixLaunch(profile: LaunchProfile): string {
  const settings = Object.entries(profile.environment).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error("Invalid shell environment variable.");
    return value === null
      ? `unset ${key}`
      : `export ${key}=${quotePosix(value)}`;
  });
  return [
    "(",
    ...settings,
    [profile.executable, ...profile.args].map(quotePosix).join(" "),
    ")",
  ].join("\n");
}
