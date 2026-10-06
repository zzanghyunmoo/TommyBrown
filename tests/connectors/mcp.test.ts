import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import { McpGateway } from "../../src/main/connectors/gateway";
import { ConnectorMcp } from "../../src/main/connectors/mcp";
import { ConnectorProfiles } from "../../src/main/connectors/profiles";
import {
  ConnectorStore,
  type SecretCodec,
} from "../../src/main/connectors/store";
import { mcpEndpoint } from "../../src/shared/connectors";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-connectors-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const key = randomBytes(32);
  const codec: SecretCodec = {
    encrypt: (text) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const payload = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), payload]);
    },
    decrypt: (buffer) => {
      const cipher = createDecipheriv(
        "aes-256-gcm",
        key,
        buffer.subarray(0, 12),
      );
      cipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([
        cipher.update(buffer.subarray(28)),
        cipher.final(),
      ]).toString("utf8");
    },
  };
  const path = join(directory, "connectors.encrypted");
  return { path, codec, store: await ConnectorStore.open(path, codec) };
}
it("persists encrypted secrets while exposing only token presence and removes disconnected definitions", async () => {
  const { path, codec, store } = await fixture();
  const list = await store.add({
    kind: "mcp",
    name: "Source",
    webUrl: null,
    endpoint: "https://example.com/mcp",
    token: "private-test-token",
  });
  expect(JSON.stringify(list)).not.toContain("private-test-token");
  expect(
    (await readFile(path)).includes(Buffer.from("private-test-token")),
  ).toBe(false);
  const reopened = await ConnectorStore.open(path, codec);
  expect(reopened.list()).toEqual(list);
  expect(list[0]?.hasToken).toBe(true);
  const id = list[0]?.id;
  if (!id) throw new Error("No connector ID");
  await reopened.remove(id);
  expect((await ConnectorStore.open(path, codec)).list()).toEqual([]);
});
it("negotiates an actual HTTP MCP connection and calls only the explicitly requested tool", async () => {
  const { store } = await fixture();
  const methods: string[] = [];
  let terminated = 0;
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== "Bearer fixture-token") {
      response.writeHead(401).end();
      return;
    }
    if (request.method === "DELETE") {
      expect(request.headers["mcp-session-id"]).toBe("fixture-session");
      terminated++;
      response.writeHead(200).end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    const message = z
      .object({
        id: z.union([z.number(), z.string()]).optional(),
        method: z.string(),
        params: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString()));
    methods.push(message.method);
    if (message.id === undefined) {
      response.writeHead(202).end();
      return;
    }
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: message.params?.["protocolVersion"],
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1" },
          }
        : message.method === "tools/list"
          ? {
              tools: [
                {
                  name: "search_notes",
                  description: "Search fixture notes",
                  inputSchema: {
                    type: "object",
                    properties: { query: { type: "string" } },
                    required: ["query"],
                  },
                  annotations: { readOnlyHint: true },
                },
              ],
            }
          : { content: [{ type: "text", text: "Found a fixture note" }] };
    response.writeHead(200, {
      "content-type": "application/json",
      "mcp-session-id": "fixture-session",
    });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  cleanup.push(
    () =>
      new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      ),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  const [connector] = await store.add({
    kind: "mcp",
    name: "Fixture",
    webUrl: null,
    endpoint: `http://127.0.0.1:${address.port}/mcp`,
    token: "fixture-token",
  });
  if (!connector) throw new Error("No connector");
  const mcp = new ConnectorMcp(store);
  const check = await mcp.check(connector.id);
  expect(check.tools[0]?.name).toBe("search_notes");
  expect(methods).not.toContain("tools/call");
  expect(
    await mcp.call({
      id: connector.id,
      name: "search_notes",
      arguments: { query: "fixture" },
    }),
  ).toContain("Found a fixture note");
  expect(methods.filter((method) => method === "tools/call")).toHaveLength(1);
  await expect(
    mcp.call({ id: connector.id, name: "not_listed", arguments: {} }),
  ).rejects.toThrow(/no longer advertised/);
  expect(terminated).toBe(3);
});
it("rejects credential-bearing and unencrypted remote MCP endpoints", () => {
  for (const url of [
    "http://example.com/mcp",
    "https://user:pass@example.com/mcp",
    "https://example.com/mcp?token=secret",
    "file:///local/mcp",
  ])
    expect(() => mcpEndpoint(url)).toThrow();
  expect(mcpEndpoint("http://127.0.0.1:5000/mcp")).toBe(
    "http://127.0.0.1:5000/mcp",
  );
});
it("gives all three CLIs one revocable gateway without exposing upstream credentials", async () => {
  const { store } = await fixture();
  const [connector] = await store.add({
    kind: "mcp",
    name: "Source",
    webUrl: null,
    endpoint: "https://example.com/mcp",
    token: "fixture-only-secret",
  });
  if (!connector) throw new Error("No connector");
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-profile-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const gateway = new McpGateway(store);
  await gateway.start();
  cleanup.push(() => gateway.stop());
  const profiles = await ConnectorProfiles.open(directory, gateway);
  const session = await profiles.create([connector.id]);
  cleanup.push(() => session.dispose());
  for (const cli of ["claude", "codex", "antigravity"] as const) {
    const profile = session.profile(cli);
    expect(JSON.stringify(profile)).not.toContain("fixture-only-secret");
    expect(JSON.stringify(profile)).not.toContain("https://example.com/mcp");
    expect(profile.args).not.toHaveLength(0);
  }
  const file = session.profile("claude").args[1];
  if (!file) throw new Error("No session config");
  const config = JSON.parse(await readFile(file, "utf8"));
  expect(config.mcpServers.tommybrown.url).toMatch(
    /^http:\/\/127.0.0.1:\d+\/mcp$/,
  );
  expect(config.mcpServers.tommybrown.headers.Authorization).toBe(
    `Bearer ${session.profile("codex").environment["TOMMYBROWN_MCP_TOKEN"]}`,
  );
  expect(gateway.status().sessions).toBe(1);
  await session.dispose();
  expect(gateway.status().sessions).toBe(0);
  await expect(readFile(file)).rejects.toThrow();
  await store.remove(connector.id);
  await expect(profiles.create([connector.id])).rejects.toThrow(
    /no longer available/,
  );
}, 15000);
