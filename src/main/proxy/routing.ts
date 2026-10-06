import { setTimeout as delay } from "node:timers/promises";
import { launchRequestSchema } from "../../shared/launch";
import {
  claudeShortcuts,
  type ProviderModels,
  providerLabels,
  providers,
  resolveMapping,
} from "../../shared/model-mappings";
import {
  GatewayError,
  type Provider,
  type ProxyAccount,
  providerSchema,
} from "../../shared/proxy";
import type { ProxyKeys } from "./config";
import {
  antigravityAlias,
  type ModelMappingStore,
  mappingRevision,
  modelAlias,
} from "./model-mappings";
import { createLaunchProfile } from "./profiles";
import type { ProxyRuntime } from "./runtime";

export class ModelRouting {
  constructor(
    private readonly runtime: ProxyRuntime,
    private readonly keys: ProxyKeys,
    private readonly mappings: ModelMappingStore,
  ) {}

  async providerModels(
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

  async launchProfile(input: unknown) {
    const request = launchRequestSchema.parse(input);
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
      if (request.cli === "antigravity") {
        const selected = antigravityAlias(target.provider, request.model);
        const choices: string[] = [];
        for (const row of settings.rows) {
          const source = row.models.antigravity;
          if (!source) continue;
          const model = row.models[target.provider];
          if (!model)
            throw new GatewayError(
              "configuration",
              `${row.name} 행에 ${providerLabels[target.provider]} 모델을 입력해 주세요.`,
            );
          choices.push(
            await this.availableAlias(
              target.provider,
              model,
              catalog,
              antigravityAlias(target.provider, source),
            ),
          );
        }
        const profile = createLaunchProfile(
          { ...request, model: selected },
          { port: gateway.port, key: this.keys.client },
        );
        return {
          ...profile,
          environment: {
            ...profile.environment,
            AGY_LLM_GATEWAY_MODELS: [
              selected,
              ...choices.filter((alias) => alias !== selected),
            ].join(","),
          },
        };
      }
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
        shortcuts[`ANTHROPIC_DEFAULT_${shortcut.toUpperCase()}_MODEL_NAME`] =
          row?.models.claude ?? request.model;
        shortcuts[
          `ANTHROPIC_DEFAULT_${shortcut.toUpperCase()}_MODEL_DESCRIPTION`
        ] = `${providerLabels[target.provider]} / ${model ?? target.model}`;
      }
      const selected = claudeShortcuts.find(
        (shortcut) => shortcut === request.model.toLowerCase(),
      );
      return {
        ...profile,
        args: selected ? ["--model", selected] : profile.args,
        environment: {
          ...profile.environment,
          ...shortcuts,
          ANTHROPIC_MODEL: selected ?? alias,
          ANTHROPIC_CUSTOM_MODEL_OPTION: alias,
          ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: request.model,
          ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: `${providerLabels[target.provider]} / ${target.model}`,
        },
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
  }

  private async availableAlias(
    provider: Provider,
    model: string,
    catalog: ProviderModels,
    alias = modelAlias(provider, model),
  ): Promise<string> {
    if (!catalog[provider].includes(model))
      throw new GatewayError(
        "configuration",
        `${providerLabels[provider]} 계정에서 ${model} 모델을 사용할 수 없습니다. 계정과 모델 ID를 확인해 주세요.`,
      );
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
}
