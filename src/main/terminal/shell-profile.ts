import { delimiter, dirname } from "node:path";
import type { LaunchProfile } from "../../shared/launch";
import type { LaunchSettings } from "../../shared/launch-settings";
import type { ConnectorSession } from "../connectors/profiles";
import type { ModelService } from "../models";
import { bashProfile, quotePosix } from "./posix";
import { powerShellProfile } from "./powershell";
import { nativeCliDirectories, resolveCli } from "./resolve-cli";

export async function shellProfile(
  models: Pick<ModelService, "launchProfile">,
  settings: LaunchSettings,
  connectors?: ConnectorSession,
): Promise<LaunchProfile> {
  const environment: Record<string, string | null> = {};
  const commands: string[] = [];
  const windows = process.platform === "win32";
  if (windows) {
    const path =
      Object.entries(process.env).find(
        ([key]) => key.toLowerCase() === "path",
      )?.[1] ?? "";
    environment["Path"] = [path, ...nativeCliDirectories()]
      .filter(Boolean)
      .join(delimiter);
  }
  const quote = windows
    ? (value: string) => `'${value.replaceAll("'", "''")}'`
    : quotePosix;
  for (const cli of ["codex", "claude", "antigravity"] as const) {
    const model = settings.models[cli];
    if (!model && !connectors) continue;
    const name = cli === "antigravity" ? "agy" : cli;
    try {
      const profile = model
        ? await models.launchProfile({ cli, model })
        : { args: [], environment: {} };
      const connector = connectors?.profile(cli) ?? {
        args: [],
        environment: {},
      };
      const target = await resolveCli(cli);
      Object.assign(environment, profile.environment, connector.environment);
      const command = [
        target.executable,
        ...target.args,
        ...profile.args,
        ...connector.args,
      ]
        .map(quote)
        .join(" ");
      commands.push(
        windows
          ? `function global:${name} { & ${command} @args }`
          : `${name}() { ${command} "$@"; }\nexport -f ${name}`,
      );
      if (cli === "antigravity" && windows) {
        const path =
          Object.entries(process.env).find(
            ([key]) => key.toLowerCase() === "path",
          )?.[1] ?? "";
        environment["Path"] =
          `${dirname(target.executable)}${delimiter}${environment["Path"] ?? path}`;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      commands.push(
        windows
          ? `function global:${name} { throw ${quote(error.message)} }`
          : `${name}() { printf '%s\\n' ${quote(error.message)} >&2; return 127; }\nexport -f ${name}`,
      );
    }
    if (cli === "antigravity")
      commands.push(
        windows
          ? "Set-Alias -Scope Global antigravity agy"
          : 'antigravity() { agy "$@"; }\nexport -f antigravity',
      );
  }
  return windows
    ? powerShellProfile(environment, commands)
    : bashProfile(environment, commands);
}
