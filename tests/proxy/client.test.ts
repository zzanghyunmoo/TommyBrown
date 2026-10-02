import type { Server } from "node:http";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { ProxyClient } from "../../src/main/proxy/client";

let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
});

async function service(respond: (path: string, auth: string) => unknown) {
  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify(
        respond(request.url ?? "", request.headers.authorization ?? ""),
      ),
    );
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  return new ProxyClient({
    port: address.port,
    keys: { client: "client-key", management: "management-key" },
  });
}

describe("management boundary", () => {
  it("strips provider credentials and internal fields from account summaries", async () => {
    const client = await service((path, auth) => {
      expect(path).toBe("/v8/management/credentials");
      expect(auth).toBe("Bearer management-key");
      return {
        files: [
          {
            name: "account.json",
            provider: "codex",
            email: "user@example.test",
            status: "active",
            access_token: "private",
            path: "private-path",
            disabled: false,
          },
        ],
      };
    });
    const accounts = await client.accounts();
    expect(accounts).toEqual([
      {
        name: "account.json",
        provider: "codex",
        email: "user@example.test",
        status: "active",
        disabled: false,
      },
    ]);
    expect(JSON.stringify(accounts)).not.toContain("private");
  });

  it("uses the client key for live model discovery", async () => {
    const client = await service((path, auth) => {
      expect(path).toBe("/v1/models");
      expect(auth).toBe("Bearer client-key");
      return { data: [{ id: "provider/model", owned_by: "provider" }] };
    });
    expect(await client.models()).toEqual([
      { id: "provider/model", owned_by: "provider" },
    ]);
  });

  it("starts a callback-enabled login and validates the authorization host", async () => {
    const client = await service((path) => {
      expect(path).toBe(
        "/v8/management/oauth/auth-url?provider=codex&is_webui=true",
      );
      return {
        url: "https://auth.openai.com/oauth/authorize?state=pending",
        state: "pending",
        status: "ok",
      };
    });
    expect((await client.beginLogin("codex")).state).toBe("pending");
  });

  it("rejects remote code schemes and unrelated login hosts", async () => {
    const client = await service(() => ({
      url: "https://auth.openai.com.evil.test/steal",
      state: "pending",
    }));
    await expect(client.beginLogin("codex")).rejects.toThrow(
      /authorization URL/i,
    );
  });

  it("does not treat a pending OAuth callback as a completed login", async () => {
    const client = await service(() => ({ status: "wait" }));
    expect((await client.loginStatus("pending")).status).toBe("wait");
    await expect(client.loginStatus("")).rejects.toThrow();
  });
});
