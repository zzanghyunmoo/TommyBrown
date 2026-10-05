import type { LaunchProfile, LaunchRequest } from "../../shared/launch";
import type { ConnectorStore } from "./store";

export function connectorProfile(
  store: ConnectorStore,
  cli: LaunchRequest["cli"],
  ids: readonly string[],
): Pick<LaunchProfile, "args" | "environment"> {
  if (cli === "antigravity" && ids.length)
    throw new Error(
      "Antigravity does not support per-session TommyBrown MCP connectors.",
    );
  const args: string[] = [];
  const environment: Record<string, string> = {};
  const servers: Record<
    string,
    { type: "http"; url: string; headers: Record<string, string> }
  > = {};
  for (const id of new Set(ids)) {
    const connector = store.require(id);
    if (!connector.endpoint)
      throw new Error(`${connector.name} has no MCP endpoint.`);
    const name = `tommybrown_${id.replaceAll("-", "")}`;
    const variable = `${name.toUpperCase()}_TOKEN`;
    if (connector.token) environment[variable] = connector.token;
    if (cli === "codex") {
      args.push(
        "-c",
        `mcp_servers.${name}.url=${JSON.stringify(connector.endpoint)}`,
      );
      if (connector.token)
        args.push(
          "-c",
          `mcp_servers.${name}.bearer_token_env_var=${JSON.stringify(variable)}`,
        );
    } else {
      servers[name] = {
        type: "http",
        url: connector.endpoint,
        headers: connector.token
          ? { Authorization: `Bearer \${${variable}}` }
          : {},
      };
    }
  }
  if (cli === "claude" && Object.keys(servers).length)
    args.push("--mcp-config", JSON.stringify({ mcpServers: servers }));
  return { args, environment };
}
