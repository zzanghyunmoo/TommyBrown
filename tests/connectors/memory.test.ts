import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, expect, it } from "vitest";
import { McpGateway } from "../../src/main/connectors/gateway";
import { ConnectorMcp } from "../../src/main/connectors/mcp";
import { MemoryConnector } from "../../src/main/connectors/memory";
import { ConnectorStore } from "../../src/main/connectors/store";
import { exactTransport } from "../../src/main/connectors/transport";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const codec = {
  encrypt: (value: string) => Buffer.from(value),
  decrypt: (value: Buffer) => value.toString(),
};
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-memory-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "connectors.encrypted");
  const store = await ConnectorStore.open(path, codec);
  const runtime = {
    directory: join(directory, "memory"),
    executable: process.execPath,
    script: resolve(
      "node_modules/@modelcontextprotocol/server-memory/dist/index.js",
    ),
  };
  const mcp = new ConnectorMcp(store, new MemoryConnector(runtime));
  await store.add({
    kind: "memory",
    name: "Memory",
    webUrl: "https://github.com/modelcontextprotocol/servers/",
    endpoint: null,
    token: null,
  });
  const id = store.list()[0]?.id;
  if (!id) throw new Error("Missing Memory connector");
  return { path, store, runtime, mcp, id };
}

it("persists actual Memory calls, serializes writers and enforces gateway permissions after restart", async () => {
  const { path, store, runtime, mcp, id } = await fixture();
  const tools = await mcp.check(id);
  expect(tools.tools.map((tool) => tool.name)).toEqual(
    expect.arrayContaining(["create_entities", "search_nodes", "read_graph"]),
  );
  await Promise.all(
    ["alpha", "beta"].map((name) =>
      mcp.call({
        id,
        name: "create_entities",
        arguments: {
          entities: [
            { name, entityType: "test", observations: ["synthetic test data"] },
          ],
        },
      }),
    ),
  );
  await store.setTools({ id, allowedTools: ["read_graph"] });
  const reopened = await ConnectorStore.open(path, codec);
  const restarted = new ConnectorMcp(reopened, new MemoryConnector(runtime));
  const graph = await restarted.call({ id, name: "read_graph", arguments: {} });
  expect(graph).toContain("alpha");
  expect(graph).toContain("beta");
  await expect(
    restarted.call({
      id,
      name: "delete_entities",
      arguments: { entityNames: ["alpha"] },
    }),
  ).rejects.toThrow(/blocked/);
  expect((await restarted.check(id)).tools.length).toBeGreaterThan(1);
  const gateway = new McpGateway(reopened, restarted);
  await gateway.start();
  cleanup.push(() => gateway.stop());
  const lease = gateway.lease([id]);
  const client = new Client({ name: "memory-test", version: "1" });
  await client.connect(
    exactTransport(
      new StreamableHTTPClientTransport(new URL(lease.url), {
        requestInit: { headers: { Authorization: `Bearer ${lease.token}` } },
      }),
    ),
  );
  cleanup.push(() => client.close());
  const catalog = await client.listTools();
  expect(catalog.tools).toHaveLength(1);
  const tool = catalog.tools[0];
  if (!tool) throw new Error("Missing graph tool");
  expect(tool.name).toMatch(/^read_graph_/);
  expect(
    JSON.stringify(await client.callTool({ name: tool.name, arguments: {} })),
  ).toContain("beta");
  await reopened.setTools({ id, allowedTools: [] });
  await expect(
    client.callTool({ name: tool.name, arguments: {} }),
  ).rejects.toThrow(/blocked/);
  expect((await client.listTools()).tools).toEqual([]);
}, 30000);

it("migrates existing connectors, preserves explicit empty policies and rejects malformed policies", async () => {
  const { path, store, id } = await fixture();
  expect(() => store.setTools({ id, allowedTools: [""] })).toThrow();
  await expect(
    store.setTools({ id: randomUUID(), allowedTools: [] }),
  ).rejects.toThrow(/no longer available/);
  await store.setTools({ id, allowedTools: [] });
  expect(
    (await ConnectorStore.open(path, codec)).require(id).allowedTools,
  ).toEqual([]);
  const legacy = { ...store.require(id), allowedTools: undefined };
  await writeFile(path, JSON.stringify({ version: 1, connectors: [legacy] }));
  expect(
    (await ConnectorStore.open(path, codec)).require(id).allowedTools,
  ).toBeNull();
});
