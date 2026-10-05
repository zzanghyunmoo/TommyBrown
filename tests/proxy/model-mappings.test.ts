import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileAliases,
  ModelMappingStore,
  modelAlias,
} from "../../src/main/proxy/model-mappings";
import {
  emptyMappings,
  launchModels,
  modelMappingsSchema,
  providers,
  resolveMapping,
} from "../../src/shared/model-mappings";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
function fixture() {
  return modelMappingsSchema.parse({
    version: 1,
    routes: { codex: null, claude: null, antigravity: null },
    rows: [
      {
        id: randomUUID(),
        name: "Balanced",
        models: {
          codex: "gpt-test",
          claude: "claude-test",
          antigravity: "google-test",
        },
        claudeShortcut: "sonnet",
      },
    ],
  });
}
describe("provider model mappings", () => {
  it("resolves all six directions without requiring the source account", () => {
    for (const source of providers)
      for (const target of providers) {
        if (source === target) continue;
        const settings = fixture();
        settings.routes[source] = target;
        const row = settings.rows[0];
        if (!row) throw new Error("Missing row");
        expect(
          resolveMapping(settings, source, row.models[source] ?? ""),
        ).toEqual({ provider: target, model: row.models[target] });
        expect(launchModels(settings, source, [])).toEqual([
          row.models[source],
        ]);
      }
  });
  it("keeps direct selection opt-in and blocks missing mappings and targets", () => {
    const settings = fixture();
    expect(resolveMapping(settings, "codex", "anything")).toBeNull();
    expect(launchModels(settings, "codex", [{ id: "live-model" }])).toEqual([
      "live-model",
    ]);
    settings.routes.codex = "antigravity";
    expect(() => resolveMapping(settings, "codex", "unmapped")).toThrow(
      "매핑이 없습니다",
    );
    const row = settings.rows[0];
    if (!row) throw new Error("Missing row");
    row.models.antigravity = null;
    expect(() => resolveMapping(settings, "codex", "gpt-test")).toThrow(
      "Antigravity 모델",
    );
  });
  it("rejects ambiguous duplicates, shortcut collisions, internal aliases, and shell syntax", () => {
    const first = fixture().rows[0];
    if (!first) throw new Error("Missing row");
    for (const model of ["GPT-TEST", "tb-codex-internal", "x;echo", "a b"]) {
      const settings = fixture();
      settings.rows.push({
        ...first,
        id: randomUUID(),
        models: { codex: model, claude: "another", antigravity: null },
        claudeShortcut: null,
      });
      expect(modelMappingsSchema.safeParse(settings).success).toBe(false);
    }
    const settings = fixture();
    settings.rows.push({
      ...first,
      id: randomUUID(),
      models: { codex: "other", claude: "sonnet", antigravity: null },
      claudeShortcut: null,
    });
    expect(modelMappingsSchema.safeParse(settings).success).toBe(false);
    settings.rows[1] = {
      ...first,
      id: randomUUID(),
      models: { codex: "other", claude: "another", antigravity: null },
    };
    expect(modelMappingsSchema.safeParse(settings).success).toBe(false);
  });
  it("maps Claude shortcuts explicitly and isolates identical upstream IDs by provider", () => {
    const settings = fixture();
    settings.routes.claude = "codex";
    expect(resolveMapping(settings, "claude", "sonnet")).toEqual({
      provider: "codex",
      model: "gpt-test",
    });
    const aliases = compileAliases(settings);
    expect(aliases.codex).toEqual([
      { name: "gpt-test", alias: modelAlias("codex", "gpt-test"), fork: true },
    ]);
    expect(modelAlias("codex", "same")).not.toBe(
      modelAlias("antigravity", "same"),
    );
    expect(modelAlias("codex", "same")).not.toBe(
      modelAlias("codex", "changed"),
    );
  });
  it("persists atomically and preserves saved data on validation failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tb-mappings-"));
    directories.push(directory);
    const path = join(directory, "mappings.json");
    const store = await ModelMappingStore.open(path);
    expect(store.snapshot()).toEqual(emptyMappings());
    const settings = fixture();
    await store.save(settings);
    expect((await ModelMappingStore.open(path)).snapshot()).toEqual(settings);
    const saved = await readFile(path, "utf8");
    settings.rows.push(...settings.rows);
    await expect(store.save(settings)).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe(saved);
    await writeFile(path, "broken");
    await expect(ModelMappingStore.open(path)).rejects.toThrow("설정 파일");
  });
});
