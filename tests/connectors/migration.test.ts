import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { afterEach, expect, it } from "vitest";
import { ConnectorMcp } from "../../src/main/connectors/mcp";
import { ConnectorStore } from "../../src/main/connectors/store";
import { encryptedStore } from "../fixtures/connector-store";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
it("splits legacy web/MCP records atomically while preserving web partitions, Memory IDs and tool policies", async () => {
  const f = await encryptedStore();
  cleanup.push(f.close);
  const webId = randomUUID();
  const memoryId = randomUUID();
  await writeFile(
    f.path,
    f.codec.encrypt(
      JSON.stringify({
        version: 1,
        connectors: [
          {
            id: webId,
            kind: "slack",
            name: "Legacy Slack",
            webUrl: "https://app.slack.com/",
            endpoint: "https://example.com/mcp",
            token: "legacy-secret",
            allowedTools: ["search"],
          },
          {
            id: memoryId,
            kind: "memory",
            name: "Memory",
            webUrl: "https://example.com/",
            endpoint: null,
            token: null,
            allowedTools: ["read_graph"],
          },
        ],
      }),
    ),
  );
  const migrated = await ConnectorStore.open(f.path, f.codec);
  expect(migrated.require(webId)).toMatchObject({
    webUrl: "https://app.slack.com/",
    endpoint: null,
    token: null,
  });
  const remote = migrated.list().find((item) => item.kind === "mcp");
  if (!remote) throw new Error("Missing migrated server.");
  expect(migrated.require(remote.id)).toMatchObject({
    webUrl: null,
    token: "legacy-secret",
    allowedTools: ["search"],
  });
  expect(migrated.require(memoryId)).toMatchObject({
    webUrl: null,
    allowedTools: ["read_graph"],
  });
  expect((await ConnectorStore.open(f.path, f.codec)).list()).toEqual(
    migrated.list(),
  );
  await migrated.remove(remote.id);
  expect(migrated.require(webId).webUrl).toBe("https://app.slack.com/");
  await expect(new ConnectorMcp(migrated).check(webId)).rejects.toThrow(
    /Web connectors/,
  );
});
it("rejects mixed web credentials and service registration through the generic MCP boundary", async () => {
  const f = await encryptedStore();
  cleanup.push(f.close);
  expect(() =>
    f.store.add({
      kind: "slack",
      name: "Mixed",
      webUrl: "https://app.slack.com/",
      endpoint: "https://example.com/mcp",
      token: "secret",
    }),
  ).toThrow(/Web connectors/);
  expect(() =>
    f.store.add({
      kind: "atlassian-service",
      name: "Forged",
      webUrl: null,
      endpoint: "https://evil.example/mcp",
      token: "secret",
    }),
  ).toThrow(/service registration/);
  expect(() =>
    f.store.addService({ kind: "slack-service", name: "Slack" }),
  ).toThrow(/Client ID/);
  const [service] = await f.store.addService({
    kind: "slack-service",
    name: "Slack",
    clientId: "synthetic-client",
    clientSecret: "synthetic-secret",
  });
  expect(JSON.stringify(service)).not.toMatch(
    /synthetic-client|synthetic-secret/,
  );
  expect(service?.allowedTools).toEqual([]);
});
