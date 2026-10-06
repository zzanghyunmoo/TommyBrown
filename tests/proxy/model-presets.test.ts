import { describe, expect, it } from "vitest";
import {
  emptyMappings,
  modelMappingsSchema,
  type ProviderModels,
} from "../../src/shared/model-mappings";
import { addPurposeMappings } from "../../src/shared/model-presets";

const emptyCatalog: ProviderModels = { codex: [], claude: [], antigravity: [] };

describe("purpose model presets", () => {
  it("creates four explicit request aliases without inventing account availability", () => {
    const settings = addPurposeMappings(emptyMappings(), emptyCatalog);
    expect(settings.rows.map((row) => row.models)).toEqual([
      { codex: "astra", claude: "fable", antigravity: "gemini-4-argon" },
      { codex: "sol", claude: "opus", antigravity: "gemini-pro" },
      { codex: "terra", claude: "sonnet", antigravity: "gemini-flash" },
      { codex: "luna", claude: "haiku", antigravity: "gemini-flash-lite" },
    ]);
    expect(settings.routes).toEqual(emptyMappings().routes);
    expect(modelMappingsSchema.safeParse(settings).success).toBe(true);
  });
  it("chooses registered families and groups Pro effort variants in the same tier", () => {
    const settings = addPurposeMappings(emptyMappings(), {
      codex: [
        "gpt-6-astra",
        "gpt-5.6-terra",
        "gpt-6-sol",
        "gpt-6.1-sol",
        "gpt-6-luna",
        "tb-codex-hidden",
      ],
      claude: [
        "claude-fable-5-5",
        "claude-opus-5-5",
        "claude-sonnet-5-5",
        "claude-haiku-4-5",
      ],
      antigravity: [
        "gemini-4-argon-preview",
        "gemini-3.1-pro-high",
        "gemini-3.1-pro-low",
        "gemini-3.8-flash-medium",
        "gemini-3.5-flash-lite",
      ],
    });
    expect(settings.rows.map((row) => row.models.codex)).toEqual([
      "gpt-6-astra",
      "gpt-6.1-sol",
      "gpt-5.6-terra",
      "gpt-6-luna",
    ]);
    expect(settings.rows.map((row) => row.models.antigravity)).toEqual([
      "gemini-4-argon-preview",
      "gemini-3.1-pro-low",
      "gemini-3.8-flash-medium",
      "gemini-3.5-flash-lite",
    ]);
    expect(modelMappingsSchema.safeParse(settings).success).toBe(true);
  });
  it("fills missing purposes without replacing saved model choices, IDs or routes", () => {
    const saved = emptyMappings();
    const row = {
      id: crypto.randomUUID(),
      name: "내 추론 설정",
      claudeShortcut: "fable" as const,
      models: { codex: "pinned-astra", claude: "fable", antigravity: null },
    };
    saved.rows.push(row);
    saved.routes.claude = "codex";
    const settings = addPurposeMappings(saved, emptyCatalog);
    expect(settings.rows[0]).toEqual({
      ...row,
      models: { ...row.models, antigravity: "gemini-4-argon" },
    });
    expect(settings.rows).toHaveLength(4);
    expect(settings.routes).toEqual(saved.routes);
    expect(saved.rows).toEqual([row]);
    expect(addPurposeMappings(settings, emptyCatalog)).toEqual(settings);
  });
  it("does not reuse an occupied target or exceed the row limit", () => {
    const saved = emptyMappings();
    saved.rows = Array.from({ length: 63 }, (_, index) => ({
      id: crypto.randomUUID(),
      name: `custom ${index}`,
      claudeShortcut: null,
      models: {
        codex: `custom-${index}`,
        claude: `other-${index}`,
        antigravity: null,
      },
    }));
    saved.rows[0] = {
      id: crypto.randomUUID(),
      name: "Pinned",
      claudeShortcut: null,
      models: { codex: "gpt-6-astra", claude: "custom", antigravity: null },
    };
    const result = addPurposeMappings(saved, {
      ...emptyCatalog,
      codex: ["gpt-6-astra"],
    });
    expect(result.rows).toHaveLength(64);
    expect(result.rows[63]?.models.codex).toBe("astra");
    expect(modelMappingsSchema.safeParse(result).success).toBe(true);
  });
  it("recognizes case-insensitive source aliases without duplicating purposes", () => {
    const saved = addPurposeMappings(emptyMappings(), emptyCatalog);
    const first = saved.rows[0];
    if (!first) throw new Error("Missing preset");
    first.models.claude = "FABLE";
    first.claudeShortcut = null;
    first.models.antigravity = null;
    const result = addPurposeMappings(saved, emptyCatalog);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]?.models.antigravity).toBe("gemini-4-argon");
    expect(modelMappingsSchema.safeParse(result).success).toBe(true);
  });
});
