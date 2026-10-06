import { z } from "zod";
import { modelIdSchema } from "./launch";
import { type Provider, providerSchema } from "./proxy";

export const providers = ["codex", "claude", "antigravity"] as const;
export const providerLabels: Record<Provider, string> = {
  codex: "OpenAI",
  claude: "Claude",
  antigravity: "Antigravity",
};
export const cliLabels: Record<Provider, string> = {
  codex: "Codex",
  claude: "Claude Code",
  antigravity: "Antigravity",
};
export const claudeShortcuts = ["fable", "opus", "sonnet", "haiku"] as const;
const mappingModel = modelIdSchema
  .refine(
    (model) => !model.toLowerCase().startsWith("tb-"),
    "tb-로 시작하는 이름은 내부 라우팅용입니다.",
  )
  .nullable();
export const mappingRowSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    models: z.object({
      codex: mappingModel,
      claude: mappingModel,
      antigravity: mappingModel,
    }),
    claudeShortcut: z.enum(claudeShortcuts).nullable(),
  })
  .refine(
    (row) => providers.filter((provider) => row.models[provider]).length >= 2,
    "한 행에 두 제공자 이상의 모델 ID를 입력해 주세요.",
  )
  .refine(
    (row) => !row.claudeShortcut || !!row.models.claude,
    "Claude 단축 이름을 연결하려면 Claude 모델 ID를 입력해 주세요.",
  );
export type ModelMapping = z.infer<typeof mappingRowSchema>;
export const modelMappingsSchema = z
  .object({
    version: z.literal(1),
    rows: z.array(mappingRowSchema).max(64),
    routes: z.object({
      codex: providerSchema.nullable(),
      claude: providerSchema.nullable(),
      antigravity: providerSchema.nullable(),
    }),
  })
  .superRefine((settings, context) => {
    const ids = new Set<string>();
    const shortcuts = new Set<string>();
    const models = new Set<string>();
    for (const [index, row] of settings.rows.entries()) {
      const issue = (message: string) =>
        context.addIssue({ code: "custom", path: ["rows", index], message });
      if (ids.has(row.id)) issue("중복된 매핑 행입니다.");
      ids.add(row.id);
      if (row.claudeShortcut) {
        if (shortcuts.has(row.claudeShortcut))
          issue("Claude 단축 이름은 한 행에만 연결할 수 있습니다.");
        shortcuts.add(row.claudeShortcut);
      }
      for (const provider of providers) {
        const model = row.models[provider];
        if (!model) continue;
        const key = `${provider}:${model.toLowerCase()}`;
        if (models.has(key))
          issue(`${providerLabels[provider]} 모델이 다른 행과 중복됩니다.`);
        models.add(key);
      }
    }
    for (const shortcut of claudeShortcuts) {
      const named = settings.rows.find(
        (row) => row.models.claude?.toLowerCase() === shortcut,
      );
      const assigned = settings.rows.find(
        (row) => row.claudeShortcut === shortcut,
      );
      if (named && assigned && named.id !== assigned.id)
        context.addIssue({
          code: "custom",
          path: ["rows"],
          message: `${shortcut} 단축 이름이 다른 행의 모델과 충돌합니다.`,
        });
    }
  });
export type ModelMappings = z.infer<typeof modelMappingsSchema>;
export type ProviderModels = Record<Provider, readonly string[]>;
export function emptyMappings(): ModelMappings {
  return {
    version: 1,
    rows: [],
    routes: { codex: null, claude: null, antigravity: null },
  };
}
export function mappingFor(
  settings: ModelMappings,
  source: Provider,
  model: string,
) {
  return settings.rows.find(
    (row) =>
      row.models[source]?.toLowerCase() === model.toLowerCase() ||
      (source === "claude" && row.claudeShortcut === model.toLowerCase()),
  );
}
export function resolveMapping(
  settings: ModelMappings,
  source: Provider,
  model: string,
) {
  const provider = settings.routes[source];
  if (!provider) return null;
  const row = mappingFor(settings, source, model);
  if (!row)
    throw new Error(
      "선택한 모델의 매핑이 없습니다. 모델 연결에서 매핑을 추가해 주세요.",
    );
  const target = row.models[provider];
  if (!target)
    throw new Error(
      `${row.name} 행에 ${providerLabels[provider]} 모델을 입력해 주세요.`,
    );
  return { provider, model: target };
}
export function launchModels(
  settings: ModelMappings,
  cli: Provider,
  available: readonly { readonly id: string }[],
) {
  if (!settings.routes[cli]) return available.map((model) => model.id);
  return settings.rows.flatMap((row) =>
    row.models[cli] ? [row.models[cli]] : [],
  );
}

export function launchModelLabel(
  settings: ModelMappings,
  cli: Provider,
  model: string,
) {
  const row = mappingFor(settings, cli, model);
  return row ? `${row.name} · ${model}` : model;
}
