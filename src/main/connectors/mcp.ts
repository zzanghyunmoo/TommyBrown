import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type ConnectorCheck,
  type ConnectorTool,
  connectorCallSchema,
  mcpEndpoint,
} from "../../shared/connectors";
import { connectorFetch } from "./http";
import type { ConnectorStore } from "./store";
import { exactTransport } from "./transport";

export class ConnectorMcp {
  constructor(private readonly store: ConnectorStore) {}
  async check(id: string): Promise<ConnectorCheck> {
    return this.withClient(id, async (client) => ({
      tools: await this.tools(client),
      checkedAt: new Date().toISOString(),
    }));
  }
  async call(input: unknown): Promise<string> {
    const request = connectorCallSchema.parse(input);
    if (JSON.stringify(request.arguments).length > 65536)
      throw new Error("Tool arguments are too large.");
    return this.withClient(request.id, async (client) => {
      const tools = await this.tools(client);
      if (!tools.some((tool) => tool.name === request.name))
        throw new Error("This tool is no longer advertised by the connector.");
      const result = await client.callTool(
        { name: request.name, arguments: request.arguments },
        undefined,
        { timeout: 30000 },
      );
      const text = JSON.stringify(result, null, 2);
      if (text.length > 2 * 1024 * 1024)
        throw new Error("The tool response is too large to display.");
      return text;
    });
  }
  private async tools(client: Client): Promise<readonly ConnectorTool[]> {
    const tools: ConnectorTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const response = await client.listTools(cursor ? { cursor } : {}, {
        timeout: 15000,
      });
      for (const tool of response.tools) {
        tools.push({
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: tool.inputSchema,
          readOnly: tool.annotations?.readOnlyHint === true,
        });
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
  ): Promise<T> {
    const connector = this.store.require(id);
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
      fetch: (input, init) => connectorFetch(endpoint, input, init),
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1,
      },
    });
    const client = new Client({ name: "TommyBrown", version: "0.1.0" });
    try {
      await client.connect(exactTransport(transport), { timeout: 15000 });
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
