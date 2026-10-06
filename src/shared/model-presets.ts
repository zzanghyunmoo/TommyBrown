import {
  type ModelMappings,
  type ProviderModels,
  providers,
} from "./model-mappings";

export const purposePresets = [
  {
    name: "심층 추론 · Astra / Fable",
    codex: "astra",
    claude: "fable",
    antigravity: "gemini-pro-high",
    google: /^gemini-.*pro.*high$/i,
  },
  {
    name: "복잡한 코딩 · Terra / Opus",
    codex: "terra",
    claude: "opus",
    antigravity: "gemini-pro",
    google: /^gemini-.*pro(?:-(?:low|medium|preview))?$/i,
  },
  {
    name: "일반 코딩 · Sol / Sonnet",
    codex: "sol",
    claude: "sonnet",
    antigravity: "gemini-flash",
    google: /^gemini-.*flash(?:-medium|-preview)?$/i,
  },
  {
    name: "빠른 작업 · Luna / Haiku",
    codex: "luna",
    claude: "haiku",
    antigravity: "gemini-flash-lite",
    google: /^gemini-.*flash-lite(?:-preview)?$/i,
  },
] as const;

/** Add missing purposes without replacing existing IDs, custom names or routes. */
export function addPurposeMappings(
  settings: ModelMappings,
  catalog: ProviderModels,
): ModelMappings {
  const rows = settings.rows.map((row) => ({
    ...row,
    models: { ...row.models },
  }));
  for (const preset of purposePresets) {
    const row = rows.find(
      (row) =>
        row.claudeShortcut === preset.claude ||
        row.models.claude?.toLowerCase() === preset.claude,
    );
    if (!row && rows.length >= 64) continue;
    const target = row ?? {
      id: crypto.randomUUID(),
      name: preset.name,
      claudeShortcut: preset.claude,
      models: { codex: null, claude: null, antigravity: null },
    };
    if (!row) rows.push(target);
    else if (
      /^(?:Astra|Terra|Sonar|Sol|Lunar|Luna)\s*[·/]\s*(?:Fable|Opus|Sonnet|Haiku)$/i.test(
        row.name,
      )
    )
      row.name = preset.name;
    for (const provider of providers) {
      if (target.models[provider]) continue;
      const family = provider === "codex" ? preset.codex : preset.claude;
      const pattern =
        provider === "antigravity"
          ? preset.google
          : new RegExp(`(?:^|-)${family}(?:-|$)`, "i");
      const unused = (model: string) =>
        !rows.some(
          (other) =>
            other.id !== target.id &&
            other.models[provider]?.toLowerCase() === model.toLowerCase(),
        );
      const candidates = catalog[provider].filter(
        (id) => !id.startsWith("tb-") && pattern.test(id) && unused(id),
      );
      candidates.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
      const model = candidates[0] ?? preset[provider];
      if (unused(model)) target.models[provider] = model;
    }
  }
  return { ...settings, rows };
}
