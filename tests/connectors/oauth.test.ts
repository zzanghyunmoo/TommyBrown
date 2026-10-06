import { readFile } from "node:fs/promises";
import { createServer, request } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, expect, it, vi } from "vitest";
import { McpGateway } from "../../src/main/connectors/gateway";
import { ConnectorMcp } from "../../src/main/connectors/mcp";
import { ServiceOAuth } from "../../src/main/connectors/oauth";
import { ConnectorStore } from "../../src/main/connectors/store";
import { exactTransport } from "../../src/main/connectors/transport";
import { encryptedStore } from "../fixtures/connector-store";
import { oauthServer } from "../fixtures/service-oauth";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.unstubAllGlobals();
});
async function fixture(lifetimeMs = 600000, clientSecret?: string) {
  const disk = await encryptedStore();
  cleanup.push(disk.close);
  const remote = await oauthServer(undefined, clientSecret);
  cleanup.push(remote.close);
  const temporary = createServer();
  await new Promise<void>((resolve) =>
    temporary.listen(0, "127.0.0.1", resolve),
  );
  const address = temporary.address();
  if (!address || typeof address === "string")
    throw new Error("No callback port.");
  await new Promise<void>((resolve) => temporary.close(() => resolve()));
  const redirectUrl = `http://127.0.0.1:${address.port}/oauth/callback`;
  let opened = "";
  const [connector] = await disk.store.addService({
    kind: clientSecret ? "slack-service" : "atlassian-service",
    name: "Service fixture",
    ...(clientSecret ? { clientId: "fixture-client", clientSecret } : {}),
  });
  if (!connector) throw new Error("No connector.");
  if (clientSecret)
    await disk.store.updateOAuth(connector.id, (current) => {
      if (!current.client) throw new Error("Missing pre-registered client.");
      return {
        ...current,
        client: { ...current.client, issuer: remote.origin },
      };
    });
  const oauth = new ServiceOAuth(disk.store, {
    redirectUrl,
    lifetimeMs,
    openExternal: async (url) => {
      opened = url;
    },
    service: () => ({
      endpoint: `${remote.origin}/mcp`,
      origins: [remote.origin],
    }),
  });
  cleanup.push(() => oauth.stop());
  return {
    ...disk,
    remote,
    oauth,
    id: connector.id,
    redirectUrl,
    get opened() {
      return opened;
    },
  };
}
async function login(f: Awaited<ReturnType<typeof fixture>>) {
  expect((await f.oauth.start(f.id)).state).toBe("waiting");
  const callback = await f.remote.approve(f.opened);
  expect((await fetch(callback)).status).toBe(200);
  await vi.waitFor(() => expect(f.oauth.status(f.id).state).toBe("connected"));
  return callback;
}
it("exchanges a PKCE code, encrypts issuer-bound tokens, restores and refreshes once for concurrent callers", async () => {
  const f = await fixture();
  const callback = await login(f);
  expect(f.remote.exchanges).toBe(1);
  await expect(fetch(callback)).rejects.toThrow();
  const serialized = JSON.stringify(f.store.list());
  expect(serialized).not.toMatch(
    /fixture-access|fixture-refresh|fixture-client|issuer|oauth/,
  );
  expect((await readFile(f.path)).includes(Buffer.from("fixture-access"))).toBe(
    false,
  );
  const reopened = await ConnectorStore.open(f.path, f.codec);
  expect(reopened.require(f.id).oauth?.tokens?.issuer).toBe(f.remote.origin);
  expect(reopened.require(f.id).oauth?.client?.issuer).toBe(f.remote.origin);
  await f.store.updateOAuth(f.id, (current) => ({ ...current, expiresAt: 0 }));
  expect(
    await Promise.all(
      Array.from({ length: 8 }, () => f.oauth.accessToken(f.id)),
    ),
  ).toEqual(Array(8).fill("fixture-access"));
  expect(f.remote.refreshes).toBe(1);
  expect(f.remote.exchanges).toBe(1);
});
it("uses the pre-registered Slack client secret for PKCE exchange and refresh without dynamic registration", async () => {
  const secret = "synthetic &+ client secret";
  const f = await fixture(600000, secret);
  await login(f);
  expect(f.remote.registrations).toBe(0);
  expect(JSON.stringify(f.store.list())).not.toContain(secret);
  expect((await readFile(f.path)).includes(Buffer.from(secret))).toBe(false);
  await f.store.updateOAuth(f.id, (current) => ({ ...current, expiresAt: 0 }));
  expect(await f.oauth.accessToken(f.id)).toBe("fixture-access");
  expect(f.remote.refreshes).toBe(1);
});
it("rejects wrong state and host without consuming the valid callback", async () => {
  const f = await fixture();
  await f.oauth.start(f.id);
  const callback = new URL(await f.remote.approve(f.opened));
  const wrong = new URL(callback);
  wrong.searchParams.set("state", "wrong");
  expect((await fetch(wrong)).status).toBe(400);
  const wrongHostStatus = await new Promise<number | undefined>(
    (resolve, reject) => {
      request(callback, { headers: { Host: "evil.example" } }, (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      })
        .on("error", reject)
        .end();
    },
  );
  expect(wrongHostStatus).toBe(400);
  expect(f.remote.exchanges).toBe(0);
  expect((await fetch(callback)).status).toBe(200);
  await vi.waitFor(() => expect(f.oauth.status(f.id).state).toBe("connected"));
});
it("cancels an in-flight token exchange without resurrecting credentials", async () => {
  const f = await fixture();
  f.remote.delayTokens(250);
  await f.oauth.start(f.id);
  await fetch(await f.remote.approve(f.opened));
  await vi.waitFor(() => expect(f.remote.exchanges).toBe(1));
  await f.oauth.cancel(f.id);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(f.store.require(f.id).oauth?.tokens).toBeNull();
  expect(f.oauth.status(f.id).state).toBe("disconnected");
});
it("expires abandoned authorization and accepts a later fresh login", async () => {
  const f = await fixture(200);
  await f.oauth.start(f.id);
  await vi.waitFor(() =>
    expect(f.oauth.status(f.id).state).toBe("disconnected"),
  );
  await expect(fetch(f.redirectUrl)).rejects.toThrow();
  expect(f.store.require(f.id).oauth?.tokens).toBeNull();
  await login(f);
});
it("prevents refresh from racing an interactive account replacement and ignores stale token rejection", async () => {
  const f = await fixture();
  await login(f);
  await f.store.updateOAuth(f.id, (current) => ({ ...current, expiresAt: 0 }));
  await f.oauth.start(f.id);
  await f.oauth.rejected(f.id, "fixture-access");
  expect(f.oauth.status(f.id).state).toBe("waiting");
  await expect(f.oauth.accessToken(f.id)).rejects.toThrow(/계정 연결을 완료/);
  expect(f.remote.refreshes).toBe(0);
  await f.oauth.cancel(f.id);
  expect(await f.oauth.accessToken(f.id)).toBe("fixture-access");
  expect(f.remote.refreshes).toBe(1);
  const expiresAt = Date.now() + 3600000;
  await f.store.updateOAuth(f.id, (current) => {
    if (!current.tokens) throw new Error("Missing fixture token.");
    return {
      ...current,
      tokens: { ...current.tokens, access_token: "replacement-token" },
      expiresAt,
    };
  });
  await f.oauth.rejected(f.id, "fixture-access");
  expect(f.store.require(f.id).oauth?.expiresAt).toBe(expiresAt);
  expect(f.oauth.status(f.id).state).toBe("connected");
  await f.oauth.rejected(f.id, "replacement-token");
  expect(f.store.require(f.id).oauth?.expiresAt).toBe(0);
});
it("handles denied consent and invalid refresh without opening a browser during a tool call", async () => {
  const f = await fixture();
  await f.oauth.start(f.id);
  await expect(f.oauth.start(f.id)).rejects.toThrow(/진행 중인/);
  const callback = new URL(f.redirectUrl);
  callback.searchParams.set(
    "state",
    new URL(f.opened).searchParams.get("state") ?? "",
  );
  callback.searchParams.set("error", "access_denied");
  expect((await fetch(callback)).status).toBe(400);
  expect(f.oauth.status(f.id).state).toBe("failed");
  await login(f);
  const opened = f.opened;
  await f.store.updateOAuth(f.id, (current) => {
    if (!current.tokens) throw new Error("Missing fixture token.");
    return {
      ...current,
      tokens: { ...current.tokens, refresh_token: "revoked-token" },
      expiresAt: 0,
    };
  });
  await expect(f.oauth.accessToken(f.id)).rejects.toThrow(/다시 연결/);
  expect(f.opened).toBe(opened);
  expect(f.oauth.status(f.id).state).toBe("failed");
  await login(f);
});
it("passes authenticated service tools through the gateway and enforces saved permissions", async () => {
  const f = await fixture();
  await login(f);
  const realFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    (input: Request | URL | string, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return realFetch(
        url.origin === "https://mcp.atlassian.com"
          ? f.remote.origin + url.pathname + url.search
          : input,
        init,
      );
    },
  );
  const mcp = new ConnectorMcp(f.store, undefined, f.oauth);
  const gateway = new McpGateway(f.store, mcp);
  await gateway.start();
  cleanup.push(() => gateway.stop());
  const lease = gateway.lease([f.id]);
  const client = new Client({ name: "oauth-test", version: "1" });
  await client.connect(
    exactTransport(
      new StreamableHTTPClientTransport(new URL(lease.url), {
        requestInit: { headers: { Authorization: `Bearer ${lease.token}` } },
      }),
    ),
  );
  cleanup.push(() => client.close());
  expect((await client.listTools()).tools).toEqual([]);
  expect((await mcp.check(f.id)).tools.map((tool) => tool.name)).toEqual([
    "search_work",
  ]);
  await f.store.setTools({ id: f.id, allowedTools: ["search_work"] });
  const [tool] = (await client.listTools()).tools;
  if (!tool) throw new Error("No service tool.");
  expect(
    JSON.stringify(await client.callTool({ name: tool.name, arguments: {} })),
  ).toContain("Synthetic service result");
  await f.store.setTools({ id: f.id, allowedTools: [] });
  await expect(
    client.callTool({ name: tool.name, arguments: {} }),
  ).rejects.toThrow(/blocked/);
  expect(f.remote.calls).toBe(1);
});
