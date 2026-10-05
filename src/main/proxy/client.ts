import ky from "ky";
import { z } from "zod";
import type { Provider } from "../../shared/proxy";
import {
  accountSchema,
  GatewayError,
  loginSchema,
  loginStatusSchema,
  modelSchema,
  providerSchema,
} from "../../shared/proxy";
import type { ProxyKeys } from "./config";
import type { ModelAliases } from "./model-mappings";

const stateSchema = z.string().min(1).max(1024);
const authHosts = {
  claude: ["claude.ai", "console.anthropic.com", "platform.claude.com"],
  codex: ["auth.openai.com"],
  antigravity: ["accounts.google.com"],
} as const;

export class ProxyClient {
  private readonly management;
  private readonly inference;

  constructor(connection: { readonly port: number; readonly keys: ProxyKeys }) {
    const base = `http://127.0.0.1:${z.number().int().min(1).max(65535).parse(connection.port)}`;
    this.management = ky.create({
      prefix: `${base}/v8/management/`,
      headers: { authorization: `Bearer ${connection.keys.management}` },
      timeout: 5000,
      retry: 0,
    });
    this.inference = ky.create({
      prefix: `${base}/v1/`,
      headers: { authorization: `Bearer ${connection.keys.client}` },
      timeout: 5000,
      retry: 0,
    });
  }

  async accounts() {
    const body = await this.management.get("credentials").json<unknown>();
    return z.object({ files: z.array(accountSchema) }).parse(body).files;
  }

  async models() {
    const body = await this.inference.get("models").json<unknown>();
    return z.object({ data: z.array(modelSchema) }).parse(body).data;
  }

  async accountModels(name: string) {
    const body = await this.management
      .get("credentials/models", { searchParams: { name } })
      .json<unknown>();
    return (
      z
        .object({ models: z.array(modelSchema).nullable().default([]) })
        .parse(body).models ?? []
    );
  }

  async setModelAliases(aliases: ModelAliases): Promise<void> {
    await this.management.put("config/oauth/model-alias", { json: aliases });
  }

  async beginLogin(provider: Provider) {
    const parsedProvider = providerSchema.parse(provider);
    const body = await this.management
      .get("oauth/auth-url", {
        searchParams: { provider: parsedProvider, is_webui: "true" },
      })
      .json<unknown>();
    const login = loginSchema.parse(body);
    const url = new URL(login.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !authHosts[parsedProvider].some((host) => host === url.hostname)
    ) {
      await this.cancelLogin(login.state);
      throw new GatewayError(
        "login",
        "The gateway returned an unexpected authorization URL.",
      );
    }
    return login;
  }

  async loginStatus(state: string) {
    const body = await this.management
      .get("oauth/status", {
        searchParams: { state: stateSchema.parse(state) },
      })
      .json<unknown>();
    return loginStatusSchema.parse(body);
  }

  async cancelLogin(state: string): Promise<void> {
    await this.management.delete("oauth/session", {
      searchParams: { state: stateSchema.parse(state) },
    });
  }
}
