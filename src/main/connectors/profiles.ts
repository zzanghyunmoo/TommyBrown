import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LaunchProfile, LaunchRequest } from "../../shared/launch";
import { protectPrivateDirectory } from "../private-directory";
import type { GatewayLease, McpGateway } from "./gateway";

export type ConnectorLaunchProfile = Pick<
  LaunchProfile,
  "args" | "environment"
>;
export type ConnectorSession = {
  readonly profile: (cli: LaunchRequest["cli"]) => ConnectorLaunchProfile;
  readonly revoke: () => void;
  readonly dispose: () => Promise<void>;
};

export class ConnectorProfiles {
  private constructor(
    private readonly directory: string,
    private readonly gateway: McpGateway,
  ) {}

  static async open(
    directory: string,
    gateway: McpGateway,
  ): Promise<ConnectorProfiles> {
    const root = resolve(directory, "mcp-sessions");
    await protectPrivateDirectory(root);
    // Only app-generated UUID directories belong to this cleanup scope.
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[0-9a-f-]{36}$/.test(entry.name)) {
        const target = join(root, entry.name);
        if (!(await lstat(target)).isSymbolicLink())
          await rm(target, { recursive: true, force: true });
      }
    }
    return new ConnectorProfiles(root, gateway);
  }

  async create(ids: readonly string[]): Promise<ConnectorSession> {
    const lease = this.gateway.lease(ids);
    const directory = join(this.directory, randomUUID());
    const plugin = join(directory, ".agents", "plugins", "tommybrown");
    const config = join(plugin, "mcp_config.json");
    let cleanup: Promise<void> | undefined;
    const dispose = () => {
      lease.revoke();
      cleanup ??= rm(directory, { recursive: true, force: true }).catch(
        (error: unknown) => {
          cleanup = undefined;
          throw error;
        },
      );
      return cleanup;
    };
    try {
      await mkdir(plugin, { recursive: true, mode: 0o700 });
      await writeFile(
        join(plugin, "plugin.json"),
        JSON.stringify({
          name: "tommybrown",
          version: "0.1.0",
          description: "Tools selected for this TommyBrown terminal",
        }),
        { mode: 0o600, flag: "wx" },
      );
      await writeFile(
        config,
        JSON.stringify({
          mcpServers: {
            tommybrown: {
              type: "http",
              url: lease.url,
              headers: { Authorization: `Bearer ${lease.token}` },
            },
          },
        }),
        { mode: 0o600, flag: "wx" },
      );
      return {
        profile: (cli) => connectorProfile(lease, cli, directory, config),
        revoke: lease.revoke,
        dispose,
      };
    } catch (error) {
      await dispose();
      throw error;
    }
  }
}

function connectorProfile(
  lease: GatewayLease,
  cli: LaunchRequest["cli"],
  directory: string,
  config: string,
): ConnectorLaunchProfile {
  switch (cli) {
    case "codex":
      return {
        args: [
          "-c",
          `mcp_servers.tommybrown.url=${JSON.stringify(lease.url)}`,
          "-c",
          'mcp_servers.tommybrown.bearer_token_env_var="TOMMYBROWN_MCP_TOKEN"',
        ],
        environment: { TOMMYBROWN_MCP_TOKEN: lease.token },
      };
    case "claude":
      return { args: ["--mcp-config", config], environment: {} };
    case "antigravity":
      return { args: ["--add-dir", directory], environment: {} };
  }
}
