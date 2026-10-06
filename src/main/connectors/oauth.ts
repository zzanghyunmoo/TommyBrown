import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  auth,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  type ServiceAuthStatus,
  servicePresets,
  serviceRedirectUrl,
} from "../../shared/connectors";
import { connectorFetch } from "./http";
import type { ConnectorStore, SavedOAuth } from "./store";

type Service = {
  readonly endpoint: string;
  readonly origins: readonly string[];
};
type Flow = {
  id: string;
  state: string;
  verifier: string;
  consumed: boolean;
  controller: AbortController;
  server: Server;
  timer: ReturnType<typeof setTimeout>;
  operation: Promise<void>;
};
type Options = {
  readonly openExternal: (url: string) => Promise<void>;
  readonly redirectUrl?: string;
  readonly service?: (id: string) => Service;
  readonly lifetimeMs?: number;
};

export class ServiceOAuth {
  private flow: Flow | undefined;
  private stopped = false;
  private readonly statuses = new Map<string, ServiceAuthStatus>();
  private readonly refreshes = new Map<
    string,
    { controller: AbortController; operation: Promise<string> }
  >();
  private readonly redirect: URL;
  constructor(
    private readonly store: ConnectorStore,
    private readonly options: Options,
  ) {
    this.redirect = new URL(options.redirectUrl ?? serviceRedirectUrl);
  }
  status(id: string): ServiceAuthStatus {
    const record = this.store.require(id);
    return (
      this.statuses.get(id) ??
      (record.oauth?.tokens
        ? {
            state: "connected",
            message: "계정 인증 저장됨 · 도구 확인 후 권한을 선택하세요.",
          }
        : { state: "disconnected", message: "계정을 연결하세요." })
    );
  }
  private service(id: string): Service {
    if (this.options.service) return this.options.service(id);
    const record = this.store.require(id);
    const preset = servicePresets.find((item) => item.kind === record.kind);
    if (!preset || record.endpoint !== preset.endpoint)
      throw new Error("Unknown service connector.");
    return preset;
  }
  async start(id: string): Promise<ServiceAuthStatus> {
    this.service(id);
    if (this.stopped) throw new Error("The application is closing.");
    if (this.flow)
      throw new Error("진행 중인 계정 연결을 완료하거나 취소하세요.");
    if (this.refreshes.has(id))
      throw new Error("인증 갱신 중입니다. 잠시 후 다시 시도하세요.");
    const server = createServer();
    const flow: Flow = {
      id,
      state: randomBytes(32).toString("base64url"),
      verifier: "",
      consumed: false,
      controller: new AbortController(),
      server,
      timer: setTimeout(() => {
        void this.cancel(id, "계정 연결 시간이 초과되었습니다.");
      }, this.options.lifetimeMs ?? 600000),
      operation: Promise.resolve(),
    };
    flow.timer.unref();
    this.flow = flow;
    this.statuses.set(id, {
      state: "waiting",
      message: "브라우저에서 계정 연결을 승인하세요.",
    });
    server.on("request", (request, response) => {
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.setHeader("cache-control", "no-store");
      response.setHeader(
        "content-security-policy",
        "default-src 'none'; frame-ancestors 'none'",
      );
      response.setHeader("referrer-policy", "no-referrer");
      let url: URL;
      try {
        url = new URL(request.url ?? "/", this.redirect);
      } catch {
        response.writeHead(400).end("Invalid callback URL.");
        return;
      }
      if (
        request.method !== "GET" ||
        request.headers.host !== this.redirect.host ||
        request.headers.origin ||
        url.origin !== this.redirect.origin ||
        url.pathname !== this.redirect.pathname ||
        url.searchParams.getAll("state").length !== 1 ||
        url.searchParams.get("state") !== flow.state ||
        flow.consumed ||
        this.flow !== flow ||
        flow.controller.signal.aborted
      ) {
        response
          .writeHead(400)
          .end("Invalid or expired authorization callback.");
        return;
      }
      flow.consumed = true;
      const code = url.searchParams.get("code");
      if (
        url.searchParams.has("error") ||
        !code ||
        code.length > 16384 ||
        url.searchParams.getAll("code").length !== 1
      ) {
        response
          .writeHead(400)
          .end("Authorization was not completed. Return to TommyBrown.");
        this.statuses.set(id, {
          state: "failed",
          message: "계정 연결이 승인되지 않았습니다. 다시 연결하세요.",
        });
        this.finish(flow);
        return;
      }
      response.end(
        "Authorization received. Return to TommyBrown to check the connection.",
      );
      this.statuses.set(id, {
        state: "exchanging",
        message: "계정 인증을 저장하고 있습니다.",
      });
      flow.operation = flow.operation.then(async () => {
        try {
          await this.authorize(id, flow.controller.signal, flow, code);
          flow.controller.signal.throwIfAborted();
          this.statuses.delete(id);
        } catch {
          if (!flow.controller.signal.aborted)
            this.statuses.set(id, {
              state: "failed",
              message:
                "계정 인증을 완료하지 못했습니다. 앱 등록 정보와 서비스 권한을 확인하고 다시 연결하세요.",
            });
        } finally {
          this.finish(flow);
        }
      });
    });
    flow.operation = (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(
            Number(this.redirect.port),
            this.redirect.hostname,
            () => {
              server.off("error", reject);
              resolve();
            },
          );
        });
        flow.controller.signal.throwIfAborted();
        await this.authorize(id, flow.controller.signal, flow);
      } catch {
        if (!flow.controller.signal.aborted)
          this.statuses.set(id, {
            state: "failed",
            message:
              "로그인을 시작하지 못했습니다. 네트워크, 앱 등록 정보 또는 콜백 포트 47931 사용 여부를 확인하세요.",
          });
        this.finish(flow);
      }
    })();
    await flow.operation;
    return this.status(id);
  }
  private finish(flow: Flow): void {
    clearTimeout(flow.timer);
    flow.server.close();
    flow.server.closeAllConnections();
    if (this.flow === flow && !flow.controller.signal.aborted)
      this.flow = undefined;
    flow.verifier = "";
  }
  async cancel(
    id: string,
    message = "계정 연결을 취소했습니다.",
  ): Promise<ServiceAuthStatus> {
    const flow = this.flow;
    if (flow?.id === id) {
      flow.controller.abort();
      this.finish(flow);
      await flow.operation;
      if (this.flow === flow) {
        this.flow = undefined;
        this.statuses.set(id, { state: "disconnected", message });
      }
    }
    const refresh = this.refreshes.get(id);
    if (refresh) {
      refresh.controller.abort();
      await refresh.operation.catch(() => undefined);
    }
    return this.status(id);
  }
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.flow) await this.cancel(this.flow.id);
    await Promise.all([...this.refreshes.keys()].map((id) => this.cancel(id)));
  }
  async accessToken(id: string): Promise<string> {
    if (this.stopped) throw new Error("The application is closing.");
    if (this.flow?.id === id)
      throw new Error(
        "진행 중인 계정 연결을 완료하거나 취소한 뒤 도구를 사용하세요.",
      );
    const saved = this.store.require(id).oauth;
    if (!saved?.tokens) throw new Error("설정 > 커넥터에서 계정을 연결하세요.");
    if (saved.expiresAt === null || saved.expiresAt > Date.now() + 60000)
      return saved.tokens.access_token;
    const existing = this.refreshes.get(id);
    if (existing) return existing.operation;
    if (!saved.tokens.refresh_token) {
      this.statuses.set(id, {
        state: "failed",
        message: "계정 인증이 만료되었습니다. 다시 연결하세요.",
      });
      throw new Error("설정 > 커넥터에서 계정을 다시 연결하세요.");
    }
    const controller = new AbortController();
    const operation = (async () => {
      try {
        await this.authorize(id, controller.signal);
        const tokens = this.store.require(id).oauth?.tokens;
        if (!tokens) throw new Error("Missing access token.");
        this.statuses.delete(id);
        return tokens.access_token;
      } catch {
        if (!controller.signal.aborted)
          this.statuses.set(id, {
            state: "failed",
            message: "계정 인증이 만료되었습니다. 다시 연결하세요.",
          });
        throw new Error(
          "계정 인증을 갱신하지 못했습니다. 설정 > 커넥터에서 다시 연결하세요.",
        );
      } finally {
        this.refreshes.delete(id);
      }
    })();
    this.refreshes.set(id, { controller, operation });
    return operation;
  }
  async rejected(id: string, token: string): Promise<void> {
    let rejectedCurrent = false;
    await this.store.updateOAuth(id, (current) => {
      if (current.tokens?.access_token !== token) return current;
      rejectedCurrent = true;
      return { ...current, expiresAt: 0 };
    });
    if (rejectedCurrent && this.flow?.id !== id)
      this.statuses.set(id, {
        state: "failed",
        message:
          "서비스가 인증을 거부했습니다. 도구 확인을 다시 시도하거나 계정을 다시 연결하세요.",
      });
  }
  private async authorize(
    id: string,
    signal: AbortSignal,
    flow?: Flow,
    code?: string,
  ): Promise<void> {
    signal = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
    const service = this.service(id);
    const update = (change: (current: SavedOAuth) => SavedOAuth) =>
      this.store
        .updateOAuth(id, (current) => {
          signal.throwIfAborted();
          return change(current);
        })
        .then(() => undefined);
    const provider: OAuthClientProvider = {
      redirectUrl: this.redirect,
      clientMetadata: {
        client_name: "TommyBrown",
        redirect_uris: [this.redirect.href],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      state: () => flow?.state ?? "",
      clientInformation: () =>
        this.store.require(id).oauth?.client ?? undefined,
      saveClientInformation: (client) =>
        update((current) => ({ ...current, client })),
      tokens: () =>
        flow ? undefined : (this.store.require(id).oauth?.tokens ?? undefined),
      saveTokens: (tokens) => {
        if (tokens.token_type.toLowerCase() !== "bearer")
          throw new Error("Unsupported token type.");
        return update((current) => ({
          ...current,
          tokens,
          expiresAt:
            tokens.expires_in === undefined
              ? null
              : Date.now() + tokens.expires_in * 1000,
        }));
      },
      redirectToAuthorization: async (url) => {
        if (!flow || code)
          throw new Error("Interactive authentication required.");
        signal.throwIfAborted();
        if (!service.origins.includes(url.origin))
          throw new Error("Untrusted authorization origin.");
        await this.options.openExternal(url.href);
      },
      saveCodeVerifier: (verifier) => {
        if (flow) flow.verifier = verifier;
      },
      codeVerifier: () => {
        if (!flow?.verifier) throw new Error("Missing PKCE verifier.");
        return flow.verifier;
      },
      invalidateCredentials: (scope) =>
        update((current) => ({
          ...current,
          ...(scope === "tokens" || scope === "all"
            ? { tokens: null, expiresAt: null }
            : {}),
          ...(scope === "client" || scope === "all" ? { client: null } : {}),
        })),
    };
    const result = await auth(provider, {
      serverUrl: service.endpoint,
      ...(code ? { authorizationCode: code } : {}),
      fetchFn: (input, init) => {
        signal.throwIfAborted();
        const url = new URL(
          input instanceof Request ? input.url : String(input),
        );
        if (!service.origins.includes(url.origin))
          throw new Error("Untrusted OAuth origin.");
        return connectorFetch(url, input, {
          ...init,
          signal: AbortSignal.any([
            signal,
            ...(init?.signal ? [init.signal] : []),
          ]),
        });
      },
    });
    if ((code || !flow) && result !== "AUTHORIZED")
      throw new Error("Authentication was not completed.");
  }
}
