import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpGateway } from "../src/main/connectors/gateway";
import { ConnectorMcp } from "../src/main/connectors/mcp";
import { MemoryConnector } from "../src/main/connectors/memory";
import { ConnectorStore } from "../src/main/connectors/store";
import { exactTransport } from "../src/main/connectors/transport";

const directory = await mkdtemp(join(tmpdir(), "tommybrown-mcp-smoke-"));
const store = await ConnectorStore.open(join(directory, "connectors.test"), {
  encrypt: (text) => Buffer.from(text),
  decrypt: (bytes) => bytes.toString(),
});
const mcp = new ConnectorMcp(
  store,
  new MemoryConnector({
    directory: join(directory, "memory"),
    executable: process.execPath,
    script: resolve("dist/main/memory.cjs"),
  }),
);
const gateway = new McpGateway(store, mcp);
const client = new Client({ name: "TommyBrown-smoke", version: "1" });
try {
  await store.add({
    kind: "context7",
    name: "Context7",
    webUrl: null,
    endpoint: "https://mcp.context7.com/mcp",
    token: null,
  });
  await store.add({
    kind: "memory",
    name: "Memory",
    webUrl: null,
    endpoint: null,
    token: null,
  });
  await gateway.start();
  const lease = gateway.lease(store.list().map((item) => item.id));
  await client.connect(
    exactTransport(
      new StreamableHTTPClientTransport(new URL(lease.url), {
        requestInit: { headers: { Authorization: `Bearer ${lease.token}` } },
      }),
    ),
  );
  const { tools } = await client.listTools();
  console.log(
    "Discovered:",
    tools.map((tool) => tool.name.replace(/_[a-f0-9]{24}$/, "")).join(", "),
  );
  const resolveLibrary = tools.find((tool) =>
    tool.name.startsWith("resolve-library-id_"),
  );
  const queryDocs = tools.find((tool) => tool.name.startsWith("query-docs_"));
  const createEntities = tools.find((tool) =>
    tool.name.startsWith("create_entities_"),
  );
  const searchNodes = tools.find((tool) =>
    tool.name.startsWith("search_nodes_"),
  );
  if (!resolveLibrary || !queryDocs || !createEntities || !searchNodes)
    throw new Error("Expected MCP tools are missing.");
  for (const call of [
    {
      name: resolveLibrary.name,
      arguments: {
        libraryName: "zod",
        query: "How to validate a string with Zod safeParse?",
      },
    },
    {
      name: queryDocs.name,
      arguments: {
        libraryId: "/colinhacks/zod",
        query: "TypeScript safeParse string validation example",
      },
    },
    {
      name: createEntities.name,
      arguments: {
        entities: [
          {
            name: "TommyBrown MCP smoke",
            entityType: "verification",
            observations: ["Synthetic gateway test record"],
          },
        ],
      },
    },
    { name: searchNodes.name, arguments: { query: "TommyBrown MCP smoke" } },
  ]) {
    const result = await client.callTool(call);
    if (result["isError"]) throw new Error(JSON.stringify(result));
    const text = JSON.stringify(result);
    if (text.length < 100) throw new Error("Unexpectedly empty MCP result.");
    console.log(
      "PASS",
      call.name.replace(/_[a-f0-9]{24}$/, ""),
      text.slice(0, 350),
    );
  }
} finally {
  await client.close();
  await gateway.stop();
  await rm(directory, { recursive: true, force: true });
}
