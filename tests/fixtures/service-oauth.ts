import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

export async function oauthServer(
  publicOrigin?: string,
  clientSecret?: string,
) {
  let origin = "";
  let opened = "";
  let exchanges = 0;
  let refreshes = 0;
  let calls = 0;
  let delay = 0;
  let registrations = 0;
  const codes = new Map<string, string>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", origin);
    let body = "";
    for await (const chunk of request) body += chunk;
    const base = publicOrigin ?? origin;
    function json(value: unknown, status = 200) {
      response
        .writeHead(status, { "content-type": "application/json" })
        .end(JSON.stringify(value));
    }
    if (url.pathname === "/opened") {
      opened = body;
      response.end();
      return;
    }
    if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
      json({
        resource: base,
        authorization_servers: [base],
        scopes_supported: ["read", "write"],
      });
      return;
    }
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      json({
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        ...(clientSecret ? {} : { registration_endpoint: `${base}/register` }),
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: [
          clientSecret ? "client_secret_post" : "none",
        ],
      });
      return;
    }
    if (url.pathname === "/register") {
      registrations++;
      const metadata = z
        .object({ redirect_uris: z.array(z.string()) })
        .parse(JSON.parse(body));
      json(
        {
          ...metadata,
          client_id: "fixture-client",
          token_endpoint_auth_method: "none",
        },
        201,
      );
      return;
    }
    if (url.pathname === "/authorize") {
      const redirect = new URL(
        url.searchParams.get("redirect_uri") ?? "http://invalid",
      );
      const challenge = url.searchParams.get("code_challenge");
      if (
        !challenge ||
        url.searchParams.get("code_challenge_method") !== "S256"
      ) {
        json({ error: "invalid_request" }, 400);
        return;
      }
      const code = randomUUID();
      codes.set(code, challenge);
      redirect.searchParams.set("code", code);
      redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
      response.writeHead(302, { location: redirect.href }).end();
      return;
    }
    if (url.pathname === "/token") {
      const params = new URLSearchParams(body);
      if (
        clientSecret &&
        (params.get("client_secret") !== clientSecret ||
          params.get("client_id") !== "fixture-client")
      ) {
        json({ error: "invalid_client" }, 401);
        return;
      }
      const refresh = params.get("grant_type") === "refresh_token";
      if (refresh) {
        refreshes++;
        if (params.get("refresh_token") !== "fixture-refresh") {
          json({ error: "invalid_grant" }, 400);
          return;
        }
      } else {
        exchanges++;
        const code = params.get("code") ?? "";
        const expected = codes.get(code);
        codes.delete(code);
        const actual = createHash("sha256")
          .update(params.get("code_verifier") ?? "")
          .digest("base64url");
        if (!expected || expected !== actual) {
          json({ error: "invalid_grant" }, 400);
          return;
        }
      }
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      json({
        access_token: "fixture-access",
        refresh_token: "fixture-refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });
      return;
    }
    if (url.pathname === "/v2/mcp" || url.pathname === "/mcp") {
      if (request.headers.authorization !== "Bearer fixture-access") {
        json({ error: "unauthorized" }, 401);
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }
      const message = z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          method: z.string(),
          params: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(JSON.parse(body));
      if (message.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      if (message.method === "tools/call") calls++;
      const result =
        message.method === "initialize"
          ? {
              protocolVersion: message.params?.["protocolVersion"],
              capabilities: { tools: {} },
              serverInfo: { name: "service-fixture", version: "1" },
            }
          : message.method === "tools/list"
            ? {
                tools: [
                  {
                    name: "search_work",
                    description: "Search synthetic work items",
                    inputSchema: { type: "object", properties: {} },
                    annotations: { readOnlyHint: true },
                  },
                ],
              }
            : { content: [{ type: "text", text: "Synthetic service result" }] };
      json({ jsonrpc: "2.0", id: message.id, result });
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port.");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    get opened() {
      return opened;
    },
    get exchanges() {
      return exchanges;
    },
    get registrations() {
      return registrations;
    },
    get refreshes() {
      return refreshes;
    },
    get calls() {
      return calls;
    },
    delayTokens(ms: number) {
      delay = ms;
    },
    async approve(authorization: string) {
      const url = new URL(authorization);
      const response = await fetch(origin + url.pathname + url.search, {
        redirect: "manual",
      });
      const callback = response.headers.get("location");
      if (!callback) throw new Error("No authorization callback.");
      return callback;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
