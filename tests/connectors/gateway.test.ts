import { request } from "node:http";
import { expect, it } from "vitest";
import { client, fixture } from "../fixtures/mcp-gateway";

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

it("enforces saved allowlists on discovery and stale direct calls in existing sessions", async () => {
  const { gateway, ids, store, calls } = await fixture();
  const id = ids[0];
  if (!id) throw new Error("Missing connector");
  const connected = await client(gateway.lease([id]));
  const name = (await connected.listTools()).tools[0]?.name;
  if (!name) throw new Error("Missing tool");
  await store.setTools({ id, allowedTools: [] });
  await expect(connected.callTool({ name, arguments: {} })).rejects.toThrow(
    /blocked/,
  );
  expect((await connected.listTools()).tools).toEqual([]);
  expect(calls).toEqual([]);
  await store.setTools({ id, allowedTools: ["read_value"] });
  expect((await connected.listTools()).tools).toHaveLength(1);
  await connected.callTool({ name, arguments: {} });
  expect(calls).toHaveLength(1);
});
