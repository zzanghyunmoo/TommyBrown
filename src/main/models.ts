import { join } from "node:path";
import { clipboard, shell } from "electron";
import type { ModelSnapshot } from "../shared/bridge";
import { launchRequestSchema } from "../shared/launch";
import type { Provider, ProxyLogin } from "../shared/proxy";
import { GatewayError, providerSchema } from "../shared/proxy";
import type { ProxyKeys } from "./proxy/config";
import { PROXY_VERSION, ProxyInstaller } from "./proxy/installer";
import { createLaunchProfile, powershellLaunch } from "./proxy/profiles";
import { ProxyRuntime } from "./proxy/runtime";
import { loadGatewayKeys } from "./secrets";

export class ModelService {
  private installed = false;
  private pending:
    | (ProxyLogin & { readonly provider: Provider; readonly startedAt: number })
    | undefined;
  private loginError: string | null = null;
  private readonly installer: ProxyInstaller;

  private constructor(
    directory: string,
    private readonly runtime: ProxyRuntime,
    private readonly keys: ProxyKeys,
  ) {
    this.installer = new ProxyInstaller(
      join(directory, "engine", PROXY_VERSION),
    );
  }

  static async create(directory: string) {
    const keys = await loadGatewayKeys(directory);
    const installer = new ProxyInstaller(
      join(directory, "engine", PROXY_VERSION),
    );
    const runtime = new ProxyRuntime({
      directory: join(directory, "gateway"),
      keys,
      command: { executable: installer.executable },
    });
    const service = new ModelService(directory, runtime, keys);
    service.installed = await installer.isInstalled();
    return service;
  }

  async snapshot(): Promise<ModelSnapshot> {
    const gateway = this.runtime.status;
    if (this.pending && gateway.phase !== "running") {
      this.pending = undefined;
      this.loginError =
        "게이트웨이가 중지되었습니다. 시작한 뒤 다시 연결해 주세요.";
    }
    if (this.pending) {
      if (Date.now() - this.pending.startedAt > 5 * 60_000) {
        await this.cancelLogin(this.pending.state);
        this.loginError = "로그인 대기 시간이 지났습니다. 다시 연결해 주세요.";
      } else {
        const status = await this.loginStatus(this.pending.state);
        if (status.status === "error")
          this.loginError = "로그인이 완료되지 않았습니다. 다시 연결해 주세요.";
      }
    }
    const [accounts, models] =
      gateway.phase === "running"
        ? await Promise.all([
            this.runtime.client().accounts(),
            this.runtime.client().models(),
          ])
        : [[], []];
    return {
      installed: this.installed,
      version: PROXY_VERSION,
      gateway,
      accounts,
      models,
      login: this.pending ?? null,
      loginError: this.loginError,
    };
  }

  async install(): Promise<void> {
    await this.installer.install();
    this.installed = true;
  }

  async start(port = 8317): Promise<void> {
    if (!(await this.installer.isInstalled()))
      throw new GatewayError(
        "integrity",
        "Install the verified gateway engine first.",
      );
    await this.runtime.start(port);
  }

  async stop(): Promise<void> {
    this.pending = undefined;
    this.loginError = null;
    await this.runtime.stop();
  }

  async login(input: unknown): Promise<ProxyLogin> {
    const provider = providerSchema.parse(input);
    if (this.pending)
      throw new GatewayError(
        "login",
        "Finish or cancel the current login first.",
      );
    const login = await this.runtime.client().beginLogin(provider);
    this.pending = { ...login, provider, startedAt: Date.now() };
    this.loginError = null;
    try {
      await shell.openExternal(login.url);
    } catch (error) {
      await this.runtime.client().cancelLogin(login.state);
      this.pending = undefined;
      throw error;
    }
    return login;
  }

  async loginStatus(state: string) {
    this.requireLogin(state);
    const status = await this.runtime.client().loginStatus(state);
    if (status.status !== "wait") this.pending = undefined;
    return status;
  }

  async cancelLogin(state: string): Promise<void> {
    this.requireLogin(state);
    await this.runtime.client().cancelLogin(state);
    this.pending = undefined;
  }

  async reopenLogin(state: string): Promise<void> {
    await shell.openExternal(this.requireLogin(state).url);
  }

  private requireLogin(state: string): ProxyLogin {
    if (!this.pending || this.pending.state !== state)
      throw new GatewayError(
        "login",
        "This login session is no longer active.",
      );
    return this.pending;
  }

  async copyLaunch(input: unknown): Promise<void> {
    clipboard.writeText(powershellLaunch(await this.launchProfile(input)));
  }

  async launchProfile(input: unknown) {
    const request = launchRequestSchema.parse(input);
    const gateway = this.runtime.status;
    if (gateway.phase !== "running")
      throw new GatewayError(
        "runtime",
        "Start the gateway before configuring a CLI.",
      );
    const available = await this.runtime.client().models();
    if (!available.some((model) => model.id === request.model))
      throw new GatewayError(
        "configuration",
        "Select a model available from your connected accounts.",
      );
    return createLaunchProfile(request, {
      port: gateway.port,
      key: this.keys.client,
    });
  }
}
