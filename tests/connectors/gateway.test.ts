import { mkdtemp, rm } from "node:fs/promises";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, expect, it } from "vitest";
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

async function fixture() {
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
      kind: "github",
      name,
      webUrl: "https://github.com/",
      endpoint,
      token: "upstream-test-secret",
    });
  const gateway = new McpGateway(store);
  await gateway.start();
  cleanup.push(() => gateway.stop());
  const ids = store.list().map((connector) => connector.id);
  return { store, gateway, ids, calls };
}

async function client(lease: GatewayLease) {
  const transport = new StreamableHTTPClientTransport(new URL(lease.url), {
    requestInit: { headers: { Authorization: `Bearer ${lease.token}` } },
  });
  const result = new Client({ name: "gateway-test", version: "1" });
  await result.connect(exactTransport(transport));
  cleanup.push(() => result.close());
  return result;
}

it("aggregates collision-free tools and preserves schemas, results and errors without retries", async () => {
  const { gateway, ids, calls } = await fixture();
  const connected = await client(gateway.lease(ids));
  const catalog = await connected.listTools();
  expect(catalog.tools).toHaveLength(2);
  expect(new Set(catalog.tools.map((tool) => tool.name)).size).toBe(2);
  const tool = catalog.tools[0];
  if (!tool) throw new Error("Missing tool");
  expect(tool.annotations?.readOnlyHint).toBe(true);
  expect(tool.outputSchema?.required).toEqual(["value"]);
  expect(
    catalog.tools.every((entry) => /^[a-zA-Z0-9_-]{1,64}$/.test(entry.name)),
  ).toBe(true);
  expect(
    await connected.callTool({ name: tool.name, arguments: { fail: true } }),
  ).toMatchObject({
    content: [{ type: "text", text: "fixture-value" }],
    structuredContent: { value: "fixture-value" },
    isError: true,
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    name: "read_value",
    arguments: { fail: true },
  });
});

it("enforces terminal scopes, rejects browser and forged requests, and revokes credentials", async () => {
  const { gateway, ids, calls } = await fixture();
  const first = ids[0];
  if (!first) throw new Error("Missing connector");
  const lease = gateway.lease([first]);
  const connected = await client(lease);
  expect((await connected.listTools()).tools).toHaveLength(1);
  const empty = await client(gateway.lease([]));
  expect((await empty.listTools()).tools).toEqual([]);
  const name = (await connected.listTools()).tools[0]?.name;
  if (!name) throw new Error("Missing tool");
  await expect(empty.callTool({ name, arguments: {} })).rejects.toThrow(
    /not available/,
  );
  expect(calls).toEqual([]);
  expect((await fetch(lease.url)).status).toBe(401);
  expect(
    (
      await fetch(lease.url, {
        headers: {
          Authorization: `Bearer ${lease.token}`,
          Origin: "http://evil.example",
        },
      })
    ).status,
  ).toBe(403);
  const forged = await new Promise<number | undefined>((resolve, reject) => {
    const outgoing = request(
      lease.url,
      {
        headers: {
          Authorization: `Bearer ${lease.token}`,
          Host: "evil.example",
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
  expect(forged).toBe(403);
  lease.revoke();
  expect(
    (
      await fetch(lease.url, {
        headers: { Authorization: `Bearer ${lease.token}` },
      })
    ).status,
  ).toBe(401);
});

it("refuses tools after their connector disappears and bounds request size", async () => {
  const { gateway, ids, store, calls } = await fixture();
  const lease = gateway.lease(ids);
  const connected = await client(lease);
  const tool = (await connected.listTools()).tools.find((entry) =>
    entry.description?.startsWith("[First]"),
  );
  const connector = store.list().find((entry) => entry.name === "First");
  if (!tool || !connector) throw new Error("Missing connector tool");
  await store.remove(connector.id);
  await expect(
    connected.callTool({ name: tool.name, arguments: {} }),
  ).rejects.toThrow(/no longer available/);
  expect(calls).toEqual([]);
  const oversized = await fetch(lease.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lease.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ payload: "x".repeat(140 * 1024) }),
  });
  expect(oversized.status).toBe(413);
});

it("cancels an in-flight upstream call when its terminal credential is revoked", async () => {
  const { gateway, ids, calls } = await fixture();
  const lease = gateway.lease(ids);
  const connected = await client(lease);
  const name = (await connected.listTools()).tools[0]?.name;
  if (!name) throw new Error("Missing tool");
  const pending = connected.callTool({ name, arguments: { wait: true } });
  const rejected = expect(pending).rejects.toThrow();
  await expect.poll(() => calls.length).toBe(1);
  lease.revoke();
  await rejected;
  expect(calls).toHaveLength(1);
});
