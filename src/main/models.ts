import { join } from "node:path";
import { clipboard, shell } from "electron";
import type { ModelSnapshot } from "../shared/bridge";
import { launchRequestSchema } from "../shared/launch";
import { modelMappingsSchema } from "../shared/model-mappings";
import type { Provider, ProxyLogin } from "../shared/proxy";
import { GatewayError, providerSchema } from "../shared/proxy";
import type { ProxyKeys } from "./proxy/config";
import { PROXY_VERSION, ProxyInstaller } from "./proxy/installer";
import {
  compileAliases,
  ModelMappingStore,
  mappingRevision,
} from "./proxy/model-mappings";
import { powershellLaunch } from "./proxy/profiles";
import { ModelRouting } from "./proxy/routing";
import { ProxyRuntime } from "./proxy/runtime";
import { loadGatewayKeys } from "./secrets";
import { resolveCli } from "./terminal/resolve-cli";

export class ModelService {
  private installed = false;
  private pending:
    | (ProxyLogin & { readonly provider: Provider; readonly startedAt: number })
    | undefined;
  private loginError: string | null = null;
  private readonly installer: ProxyInstaller;
  private queue: Promise<void> = Promise.resolve();
  private readonly routing: ModelRouting;
  private startupError: string | null = null;

  private constructor(
    directory: string,
    private readonly runtime: ProxyRuntime,
    keys: ProxyKeys,
    private readonly mappings: ModelMappingStore,
  ) {
    this.installer = new ProxyInstaller(
      join(directory, "engine", PROXY_VERSION),
    );
    this.routing = new ModelRouting(runtime, keys, mappings);
  }

  static async create(directory: string, port = 8317) {
    const keys = await loadGatewayKeys(directory);
    const installer = new ProxyInstaller(
      join(directory, "engine", PROXY_VERSION),
    );
    const runtime = new ProxyRuntime({
      directory: join(directory, "gateway"),
      keys,
      command: { executable: installer.executable },
    });
    const mappings = await ModelMappingStore.open(
      join(directory, "model-mappings.json"),
    );
    const service = new ModelService(directory, runtime, keys, mappings);
    service.installed = await installer.isInstalled();
    if (service.installed) {
      try {
        await service.start(port);
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        service.startupError = error.message;
      }
    }
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
      models: models.filter((model) => !model.id.startsWith("tb-")),
      mappings: this.mappings.snapshot(),
      mappingRevision: mappingRevision(this.mappings.snapshot()),
      providerModels: await this.routing.providerModels(accounts),
      login: this.pending ?? null,
      loginError: this.loginError ?? this.startupError,
    };
  }

  async install(): Promise<void> {
    await this.installer.install();
    this.installed = true;
  }

  async start(port = 8317): Promise<void> {
    return this.serialize(async () => {
      if (!(await this.installer.isInstalled()))
        throw new GatewayError(
          "integrity",
          "Install the verified gateway engine first.",
        );
      await this.runtime.start(port, compileAliases(this.mappings.snapshot()));
      this.startupError = null;
    });
  }

  async stop(): Promise<void> {
    return this.serialize(async () => {
      this.pending = undefined;
      this.loginError = null;
      await this.runtime.stop();
    });
  }

  saveMappings(input: unknown): Promise<void> {
    const parsed = modelMappingsSchema.safeParse(input);
    if (!parsed.success)
      throw new GatewayError(
        "configuration",
        parsed.error.issues[0]?.message ?? "모델 매핑을 확인해 주세요.",
      );
    return this.serialize(async () => {
      const previous = this.mappings.snapshot();
      const running = this.runtime.status.phase === "running";
      try {
        if (running)
          await this.runtime
            .client()
            .setModelAliases(compileAliases(parsed.data));
        await this.mappings.save(parsed.data);
      } catch {
        if (running) {
          try {
            await this.runtime
              .client()
              .setModelAliases(compileAliases(previous));
          } catch {
            await this.runtime.stop();
            throw new GatewayError(
              "configuration",
              "매핑 적용을 복구하지 못해 게이트웨이를 중지했습니다. 다시 시작해 주세요.",
            );
          }
        }
        throw new GatewayError(
          "configuration",
          "모델 매핑을 저장하지 못했습니다. 이전 설정을 유지합니다.",
        );
      }
    });
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
    const request = launchRequestSchema.parse(input);
    const profile = await this.launchProfile(request);
    const target = await resolveCli(request.cli);
    clipboard.writeText(
      powershellLaunch({
        ...profile,
        executable: target.executable,
        args: [...target.args, ...profile.args],
      }),
    );
  }

  async launchProfile(input: unknown) {
    return this.serialize(() => this.routing.launchProfile(input));
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
