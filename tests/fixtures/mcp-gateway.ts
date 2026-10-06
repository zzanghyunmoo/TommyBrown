import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach } from "vitest";
import { z } from "zod";
import {
  type GatewayLease,
  McpGateway,
} from "../../src/main/connectors/gateway";
import { ConnectorStore } from "../../src/main/connectors/store";
import { exactTransport } from "../../src/main/connectors/transport";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

export async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-mcp-gateway-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const store = await ConnectorStore.open(join(directory, "test.enc"), {
    encrypt: (text) => Buffer.from(text),
    decrypt: (bytes) => bytes.toString(),
  });
  const calls: unknown[] = [];
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== "Bearer upstream-test-secret") {
      response.writeHead(401).end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    let data = "";
    for await (const part of request) data += part;
    const message = z
      .object({
        id: z.union([z.number(), z.string()]).optional(),
        method: z.string(),
        params: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(JSON.parse(data));
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    if (message.method === "tools/call") calls.push(message.params);
    if (
      message.method === "tools/call" &&
      z
        .object({ wait: z.boolean().optional() })
        .parse(message.params?.["arguments"]).wait
    ) {
      await new Promise<void>((closed) => response.once("close", closed));
      return;
    }
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: message.params?.["protocolVersion"],
            capabilities: { tools: {} },
            serverInfo: { name: "upstream", version: "1" },
          }
        : message.method === "tools/list"
          ? {
              tools: [
                {
                  name: "read_value",
                  description: "Read a value",
                  inputSchema: {
                    type: "object",
                    properties: { fail: { type: "boolean" } },
                  },
                  outputSchema: {
                    type: "object",
                    properties: { value: { type: "string" } },
                    required: ["value"],
                  },
                  annotations: { readOnlyHint: true, idempotentHint: true },
                },
              ],
            }
          : {
              content: [{ type: "text", text: "fixture-value" }],
              structuredContent: { value: "fixture-value" },
              isError:
                z
                  .object({ fail: z.boolean().optional() })
                  .parse(message.params?.["arguments"]).fail === true,
            };
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  const endpoint = `http://127.0.0.1:${address.port}/mcp`;
  for (const name of ["First", "Second"])
    await store.add({
      kind: "mcp",
      name,
      webUrl: null,
      endpoint,
      token: "upstream-test-secret",
    });
  const gateway = new McpGateway(store);
  await gateway.start();
  cleanup.push(() => gateway.stop());
  const ids = store.list().map((connector) => connector.id);
  return { store, gateway, ids, calls };
}

export async function client(lease: GatewayLease) {
  const transport = new StreamableHTTPClientTransport(new URL(lease.url), {
    requestInit: { headers: { Authorization: `Bearer ${lease.token}` } },
  });
  const result = new Client({ name: "gateway-test", version: "1" });
  await result.connect(exactTransport(transport));
  cleanup.push(() => result.close());
  return result;
}
