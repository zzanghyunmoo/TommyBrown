import { z } from "zod";
import type { BrowserState } from "./browser";
import { browserUrl } from "./browser";

export const connectorPresets = [
  { kind: "browser", name: "Browser", url: "https://www.google.com/" },
  { kind: "slack", name: "Slack", url: "https://app.slack.com/" },
  { kind: "discord", name: "Discord", url: "https://discord.com/app" },
  {
    kind: "jira",
    name: "Jira",
    url: "https://www.atlassian.com/software/jira",
  },
  { kind: "linear", name: "Linear", url: "https://linear.app/" },
  {
    kind: "confluence",
    name: "Confluence",
    url: "https://www.atlassian.com/software/confluence",
  },
  { kind: "notion", name: "Notion", url: "https://www.notion.so/" },
  { kind: "gitlab", name: "GitLab", url: "https://gitlab.com/" },
  { kind: "github", name: "GitHub", url: "https://github.com/" },
] as const;
export const mcpPresets = [
  {
    kind: "context7",
    name: "Context7",
    endpoint: "https://mcp.context7.com/mcp",
  },
  { kind: "memory", name: "Memory", endpoint: null },
  { kind: "mcp", name: "사용자 지정 MCP", endpoint: "" },
] as const;
export const servicePresets = [
  {
    kind: "slack-service",
    name: "Slack",
    endpoint: "https://mcp.slack.com/mcp",
    issuer: "https://mcp.slack.com",
    origins: ["https://mcp.slack.com", "https://slack.com"],
  },
  {
    kind: "atlassian-service",
    name: "Atlassian",
    endpoint: "https://mcp.atlassian.com/v2/mcp?tools=all",
    issuer: "https://mcp.atlassian.com",
    origins: ["https://mcp.atlassian.com", "https://auth.atlassian.com"],
  },
] as const;
export const serviceInputSchema = z
  .object({
    kind: z.enum(servicePresets.map((preset) => preset.kind)),
    name: z.string().trim().min(1).max(80),
    clientId: z.string().trim().min(1).max(2048).optional(),
    clientSecret: z.string().trim().min(1).max(4096).optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.kind === "slack-service" &&
      (!input.clientId || !input.clientSecret)
    )
      ctx.addIssue({
        code: "custom",
        message: "Slack 앱의 Client ID와 Client Secret이 필요합니다.",
      });
  });
export const serviceRedirectUrl = "http://127.0.0.1:47931/oauth/callback";
export type ServiceAuthStatus = {
  readonly state:
    | "disconnected"
    | "waiting"
    | "exchanging"
    | "connected"
    | "failed";
  readonly message: string;
};
export function isServiceConnector(connector: {
  readonly kind: string;
}): boolean {
  return servicePresets.some((preset) => preset.kind === connector.kind);
}
export function mcpEndpoint(input: unknown): string {
  const url = new URL(browserUrl(input));
  if (url.href.includes("${"))
    throw new Error(
      "MCP endpoints cannot contain environment variable expressions.",
    );
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("MCP requires HTTPS or a local loopback address.");
  if (url.hash || (url.search && url.href !== servicePresets[1].endpoint))
    throw new Error("Put credentials in the token field, not the MCP URL.");
  return url.href;
}
export const connectorInputSchema = z.object({
  kind: z.enum(
    [...connectorPresets, ...mcpPresets, ...servicePresets].map(
      (preset) => preset.kind,
    ),
  ),
  name: z.string().trim().min(1).max(80),
  webUrl: z.string().transform(browserUrl).nullable(),
  endpoint: z.string().transform(mcpEndpoint).nullable(),
  token: z.string().trim().min(1).max(16384).nullable(),
});
export type ConnectorInput = z.input<typeof connectorInputSchema>;
export type Connector = Omit<z.output<typeof connectorInputSchema>, "token"> & {
  readonly id: string;
  readonly hasToken: boolean;
  readonly authenticated?: boolean;
  readonly allowedTools: readonly string[] | null;
};
export const connectorToolPolicySchema = z.object({
  id: z.uuid(),
  allowedTools: z.array(z.string().min(1).max(200)).max(500).nullable(),
});
export function isMcpConnector(connector: Pick<Connector, "kind">): boolean {
  return (
    isServiceConnector(connector) ||
    connector.kind === "mcp" ||
    connector.kind === "context7" ||
    connector.kind === "memory"
  );
}
export function allowsTool(
  connector: Pick<Connector, "allowedTools">,
  name: string,
): boolean {
  return (
    connector.allowedTools === null || connector.allowedTools.includes(name)
  );
}
export type ConnectorTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly readOnly: boolean;
};
export type ConnectorCheck = {
  readonly tools: readonly ConnectorTool[];
  readonly checkedAt: string;
};
export type McpGatewayStatus = {
  readonly running: boolean;
  readonly sessions: number;
};
export const connectorCallSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(200),
  arguments: z.record(z.string(), z.unknown()),
});
export interface ConnectorBridge {
  readonly addService: (
    input: z.input<typeof serviceInputSchema>,
  ) => Promise<readonly Connector[]>;
  readonly login: (id: string) => Promise<ServiceAuthStatus>;
  readonly loginStatus: (id: string) => Promise<ServiceAuthStatus>;
  readonly cancelLogin: (id: string) => Promise<ServiceAuthStatus>;
  readonly gateway: () => Promise<McpGatewayStatus>;
  readonly list: () => Promise<readonly Connector[]>;
  readonly add: (input: ConnectorInput) => Promise<readonly Connector[]>;
  readonly setTools: (
    input: z.infer<typeof connectorToolPolicySchema>,
  ) => Promise<readonly Connector[]>;
  readonly disconnect: (id: string) => Promise<readonly Connector[]>;
  readonly open: (id: string, group?: string) => Promise<BrowserState>;
  readonly check: (id: string) => Promise<ConnectorCheck>;
  readonly call: (
    input: z.infer<typeof connectorCallSchema>,
  ) => Promise<string>;
}
declare global {
  interface Window {
    readonly connectors: ConnectorBridge;
  }
}
