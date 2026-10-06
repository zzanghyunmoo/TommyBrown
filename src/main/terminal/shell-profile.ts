import { delimiter, dirname } from "node:path";
import type { LaunchProfile } from "../../shared/launch";
import type { LaunchSettings } from "../../shared/launch-settings";
import type { ModelService } from "../models";
import { powerShellProfile } from "./powershell";
import { resolveCli } from "./resolve-cli";

export async function shellProfile(
  models: ModelService,
  settings: LaunchSettings,
): Promise<LaunchProfile> {
  const environment: Record<string, string | null> = {};
  const commands: string[] = [];
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  for (const cli of ["claude", "antigravity"] as const) {
    const model = settings.models[cli];
    if (!model) continue;
    const name = cli === "antigravity" ? "agy" : "claude";
    try {
      const profile = await models.launchProfile({ cli, model });
      const target = await resolveCli(cli);
      Object.assign(environment, profile.environment);
      const command = [target.executable, ...target.args, ...profile.args]
        .map(quote)
        .join(" ");
      commands.push(`function global:${name} { & ${command} @args }`);
      if (cli === "antigravity") {
        const path =
          Object.entries(process.env).find(
            ([key]) => key.toLowerCase() === "path",
          )?.[1] ?? "";
        environment["Path"] =
          `${dirname(target.executable)}${delimiter}${path}`;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      commands.push(
        `function global:${name} { throw ${quote(error.message)} }`,
      );
    }
    if (cli === "antigravity")
      commands.push("Set-Alias -Scope Global antigravity agy");
  }
  return powerShellProfile(environment, commands);
}
