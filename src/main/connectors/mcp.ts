import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type CallToolResult,
  CallToolResultSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  allowsTool,
  type ConnectorCheck,
  connectorCallSchema,
  mcpEndpoint,
} from "../../shared/connectors";
import { connectorFetch } from "./http";
import type { MemoryConnector } from "./memory";
import type { ConnectorStore } from "./store";
import { exactTransport } from "./transport";

export class ConnectorMcp {
  constructor(
    private readonly store: ConnectorStore,
    private readonly memory?: MemoryConnector,
  ) {}
  async check(id: string): Promise<ConnectorCheck> {
    return this.withClient(id, async (client) => ({
      tools: (await this.tools(client)).map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
        readOnly: tool.annotations?.readOnlyHint === true,
      })),
      checkedAt: new Date().toISOString(),
    }));
  }
  async call(input: unknown): Promise<string> {
    return JSON.stringify(await this.callResult(input), null, 2);
  }
  async catalog(id: string, signal?: AbortSignal): Promise<Tool[]> {
    if (this.store.require(id).allowedTools?.length === 0) return [];
    const tools = await this.withClient(
      id,
      (client) => this.tools(client, signal),
      signal,
    );
    const connector = this.store.require(id);
    return tools.filter((tool) => allowsTool(connector, tool.name));
  }
  async callResult(
    input: unknown,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    const request = connectorCallSchema.parse(input);
    const authorize = () => {
      if (!allowsTool(this.store.require(request.id), request.name))
        throw new Error(
          "This tool is blocked by the connector's saved permissions.",
        );
    };
    authorize();
    if (JSON.stringify(request.arguments).length > 65536)
      throw new Error("Tool arguments are too large.");
    return this.withClient(
      request.id,
      async (client) => {
        const tools = await this.tools(client, signal);
        if (!tools.some((tool) => tool.name === request.name))
          throw new Error(
            "This tool is no longer advertised by the connector.",
          );
        authorize();
        const result = await client.callTool(
          { name: request.name, arguments: request.arguments },
          CallToolResultSchema,
          { timeout: 30000, ...(signal ? { signal } : {}) },
        );
        const text = JSON.stringify(result, null, 2);
        if (text.length > 2 * 1024 * 1024)
          throw new Error("The tool response is too large to display.");
        return CallToolResultSchema.parse(result);
      },
      signal,
    );
  }
  private async tools(client: Client, signal?: AbortSignal): Promise<Tool[]> {
    const tools: Tool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const response = await client.listTools(cursor ? { cursor } : {}, {
        timeout: 15000,
        ...(signal ? { signal } : {}),
      });
      for (const tool of response.tools) {
        tools.push(tool);
        if (tools.length > 500)
          throw new Error(
            "This connector advertises too many tools (limit 500).",
          );
      }
      if (!response.nextCursor) return tools;
      cursor = response.nextCursor;
    }
    throw new Error(
      "This connector's tool list did not finish within 10 pages.",
    );
  }
  private async withClient<T>(
    id: string,
    action: (client: Client) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const connector = this.store.require(id);
    if (connector.kind === "memory") {
      if (!this.memory)
        throw new Error("Local Memory is unavailable in this runtime.");
      return this.memory.withClient(
        id,
        action,
        signal ?? AbortSignal.timeout(30000),
      );
    }
    if (!connector.endpoint)
      throw new Error("Configure an MCP endpoint for data and tool access.");
    const endpoint = new URL(mcpEndpoint(connector.endpoint));
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: {
        headers: connector.token
          ? { Authorization: `Bearer ${connector.token}` }
          : {},
        redirect: "error",
      },
      fetch: (input, init) =>
        connectorFetch(endpoint, input, {
          ...init,
          ...(signal
            ? {
                signal: AbortSignal.any([
                  signal,
                  ...(init?.signal ? [init.signal] : []),
                ]),
              }
            : {}),
        }),
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1,
      },
    });
    const client = new Client({ name: "TommyBrown", version: "0.1.0" });
    try {
      await client.connect(exactTransport(transport), {
        timeout: 15000,
        ...(signal ? { signal } : {}),
      });
      return await action(client);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "MCP connection failed.";
      throw new Error(
        connector.token
          ? message.replaceAll(connector.token, "[redacted]")
          : message,
      );
    } finally {
      try {
        await transport.terminateSession();
      } catch {
        console.warn(
          "The connector's remote MCP session could not be released.",
        );
      } finally {
        await client.close();
      }
    }
  }
}
