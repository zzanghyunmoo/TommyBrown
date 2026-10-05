import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { clipboard, shell } from "electron";
import type { ModelSnapshot } from "../shared/bridge";
import { launchRequestSchema } from "../shared/launch";
import {
  claudeShortcuts,
  modelMappingsSchema,
  type ProviderModels,
  providerLabels,
  providers,
  resolveMapping,
} from "../shared/model-mappings";
import type { Provider, ProxyAccount, ProxyLogin } from "../shared/proxy";
import { GatewayError, providerSchema } from "../shared/proxy";
import type { ProxyKeys } from "./proxy/config";
import { PROXY_VERSION, ProxyInstaller } from "./proxy/installer";
import {
  compileAliases,
  ModelMappingStore,
  mappingRevision,
  modelAlias,
} from "./proxy/model-mappings";
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
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    directory: string,
    private readonly runtime: ProxyRuntime,
    private readonly keys: ProxyKeys,
    private readonly mappings: ModelMappingStore,
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
    const mappings = await ModelMappingStore.open(
      join(directory, "model-mappings.json"),
    );
    const service = new ModelService(directory, runtime, keys, mappings);
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
      models: models.filter((model) => !model.id.startsWith("tb-")),
      mappings: this.mappings.snapshot(),
      mappingRevision: mappingRevision(this.mappings.snapshot()),
      providerModels: await this.providerModels(accounts),
      login: this.pending ?? null,
      loginError: this.loginError,
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

  private async providerModels(
    accounts: readonly ProxyAccount[],
  ): Promise<ProviderModels> {
    const catalog: Record<Provider, string[]> = {
      codex: [],
      claude: [],
      antigravity: [],
    };
    await Promise.all(
      accounts
        .filter((account) => !account.disabled)
        .map(async (account) => {
          const provider = providerSchema.safeParse(account.provider);
          if (!provider.success) return;
          const models = await this.runtime
            .client()
            .accountModels(account.name);
          catalog[provider.data].push(...models.map((model) => model.id));
        }),
    );
    for (const provider of providers)
      catalog[provider] = [...new Set(catalog[provider])].sort();
    return catalog;
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
    return this.serialize(async () => {
      const gateway = this.runtime.status;
      if (gateway.phase !== "running")
        throw new GatewayError(
          "runtime",
          "Start the gateway before configuring a CLI.",
        );
      const settings = this.mappings.snapshot();
      if (
        request.mappingRevision &&
        request.mappingRevision !== mappingRevision(settings)
      )
        throw new GatewayError(
          "configuration",
          "모델 매핑이 변경되었습니다. 모델 목록을 다시 열어 실행 경로를 확인해 주세요.",
        );
      const target = resolveMapping(settings, request.cli, request.model);
      if (target) {
        const catalog = await this.providerModels(
          await this.runtime.client().accounts(),
        );
        const alias = await this.availableAlias(
          target.provider,
          target.model,
          catalog,
        );
        const profile = createLaunchProfile(
          { ...request, model: alias },
          { port: gateway.port, key: this.keys.client },
        );
        if (request.cli !== "claude") return profile;
        const shortcuts: Record<string, string> = {};
        for (const shortcut of claudeShortcuts) {
          const row = settings.rows.find(
            (candidate) => candidate.claudeShortcut === shortcut,
          );
          const model = row?.models[target.provider];
          if (row && !model)
            throw new GatewayError(
              "configuration",
              `${shortcut} 단축 이름에 ${providerLabels[target.provider]} 모델을 연결해 주세요.`,
            );
          shortcuts[`ANTHROPIC_DEFAULT_${shortcut.toUpperCase()}_MODEL`] = model
            ? await this.availableAlias(target.provider, model, catalog)
            : alias;
        }
        return {
          ...profile,
          environment: { ...profile.environment, ...shortcuts },
        };
      }
      const available = await this.runtime.client().models();
      if (
        request.model.startsWith("tb-") ||
        !available.some((model) => model.id === request.model)
      )
        throw new GatewayError(
          "configuration",
          "Select a model available from your connected accounts.",
        );
      return createLaunchProfile(request, {
        port: gateway.port,
        key: this.keys.client,
      });
    });
  }

  private async availableAlias(
    provider: Provider,
    model: string,
    catalog: ProviderModels,
  ): Promise<string> {
    if (!catalog[provider].includes(model))
      throw new GatewayError(
        "configuration",
        `${providerLabels[provider]} 계정에서 ${model} 모델을 사용할 수 없습니다. 계정과 모델 ID를 확인해 주세요.`,
      );
    const alias = modelAlias(provider, model);
    for (let attempt = 0; attempt < 15; attempt++) {
      if (catalog[provider].includes(alias)) {
        if (
          providers.some(
            (other) => other !== provider && catalog[other].includes(alias),
          )
        )
          throw new GatewayError(
            "configuration",
            "다른 제공자와 모델 매핑 이름이 충돌합니다. 계정의 별칭 설정을 확인해 주세요.",
          );
        return alias;
      }
      await delay(100);
      catalog = await this.providerModels(
        await this.runtime.client().accounts(),
      );
    }
    throw new GatewayError(
      "configuration",
      "모델 매핑이 아직 게이트웨이에 반영되지 않았습니다. 설정을 다시 저장해 주세요.",
    );
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
