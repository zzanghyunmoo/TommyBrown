import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { isMcpConnector, type McpGatewayStatus } from "../../shared/connectors";
import { ConnectorMcp } from "./mcp";
import type { ConnectorStore } from "./store";

type Entry = { id: string; original: string; tool: Tool };
type Session = {
  ids: readonly string[];
  abort: AbortController;
  catalog: Map<string, Entry> | null;
  active: number;
};

export type GatewayLease = {
  readonly url: string;
  readonly token: string;
  readonly revoke: () => void;
};

export class McpGateway {
  private readonly sessions = new Map<string, Session>();
  private readonly mcp: ConnectorMcp;
  private readonly server = createServer((request, response) => {
    void this.handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500).end();
      else response.end();
    });
  });
  private port: number | null = null;

  constructor(
    private readonly store: ConnectorStore,
    mcp?: ConnectorMcp,
  ) {
    this.mcp = mcp ?? new ConnectorMcp(store);
    this.server.requestTimeout = 35000;
    this.server.headersTimeout = 10000;
    this.server.maxHeadersCount = 40;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string")
      throw new Error("MCP gateway has no port.");
    this.port = address.port;
  }

  status(): McpGatewayStatus {
    return { running: this.port !== null, sessions: this.sessions.size };
  }

  lease(ids: readonly string[]): GatewayLease {
    if (this.port === null) throw new Error("The MCP gateway is unavailable.");
    if (this.sessions.size >= 16)
      throw new Error("The MCP gateway session limit was reached.");
    const selected = [...new Set(ids)];
    for (const id of selected) {
      const connector = this.store.require(id);
      if (!isMcpConnector(connector))
        throw new Error(`${connector.name} has no MCP endpoint.`);
    }
    const token = randomBytes(32).toString("base64url");
    const session: Session = {
      ids: selected,
      abort: new AbortController(),
      catalog: null,
      active: 0,
    };
    this.sessions.set(token, session);
    return {
      url: `http://127.0.0.1:${this.port}/mcp`,
      token,
      revoke: () => {
        this.sessions.delete(token);
        session.abort.abort();
      },
    };
  }

  async stop(): Promise<void> {
    this.port = null;
    for (const session of this.sessions.values()) session.abort.abort();
    this.sessions.clear();
    if (!this.server.listening) return;
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (
          error &&
          !("code" in error && error.code === "ERR_SERVER_NOT_RUNNING")
        )
          reject(error);
        else resolve();
      });
    });
  }

  private async catalog(
    session: Session,
    signal: AbortSignal,
  ): Promise<Map<string, Entry>> {
    const entries = new Map<string, Entry>();
    for (const id of session.ids) {
      const connector = this.store.require(id);
      for (const tool of await this.mcp.catalog(id, signal)) {
        const suffix = createHash("sha256")
          .update(`${id}\0${tool.name}`)
          .digest("hex")
          .slice(0, 24);
        const name = `${tool.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 36)}_${suffix}`;
        entries.set(name, {
          id,
          original: tool.name,
          tool: {
            ...tool,
            name,
            description: `[${connector.name}] ${tool.description ?? tool.name}`,
          },
        });
        if (entries.size > 500)
          throw new Error("Select fewer connectors (gateway limit 500 tools).");
      }
    }
    if (
      JSON.stringify([...entries.values()].map((entry) => entry.tool)).length >
      2 * 1024 * 1024
    )
      throw new Error("The combined MCP tool catalog is too large.");
    session.catalog = entries;
    return entries;
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (
      request.headers.host !== `127.0.0.1:${this.port}` ||
      request.headers.origin !== undefined
    ) {
      response.writeHead(403).end();
      return;
    }
    if (request.url !== "/mcp") {
      response.writeHead(404).end();
      return;
    }
    const authorization = request.headers.authorization;
    const session = authorization?.startsWith("Bearer ")
      ? this.sessions.get(authorization.slice(7))
      : undefined;
    if (!session) {
      response.writeHead(401).end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    if (session.active >= 8) {
      response.writeHead(429).end();
      return;
    }
    session.active++;
    const disconnected = new AbortController();
    const signal = AbortSignal.any([
      session.abort.signal,
      disconnected.signal,
      AbortSignal.timeout(35000),
    ]);
    response.once("close", () => disconnected.abort());
    const server = new Server(
      { name: "TommyBrown", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      maxRequestBodySize: 128 * 1024,
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...(await this.catalog(session, signal)).values()].map(
        (entry) => entry.tool,
      ),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (call) => {
      const entry = (
        session.catalog ?? (await this.catalog(session, signal))
      ).get(call.params.name);
      if (!entry)
        throw new Error("This tool is not available to this terminal.");
      return this.mcp.callResult(
        {
          id: entry.id,
          name: entry.original,
          arguments: call.params.arguments ?? {},
        },
        signal,
      );
    });
    try {
      const adapter: Transport = {
        start: () => transport.start(),
        close: () => transport.close(),
        send: (message, options) => transport.send(message, options),
      };
      transport.onmessage = (message, extra) =>
        adapter.onmessage?.(message, extra);
      transport.onerror = (error) => adapter.onerror?.(error);
      transport.onclose = () => adapter.onclose?.();
      await server.connect(adapter);
      await transport.handleRequest(request, response);
    } finally {
      session.active--;
      await server.close();
    }
  }
}
