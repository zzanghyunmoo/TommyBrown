import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  emptyMappings,
  type ModelMappings,
  modelMappingsSchema,
  providers,
} from "../../shared/model-mappings";
import type { Provider } from "../../shared/proxy";

export type ModelAliases = Record<
  Provider,
  { name: string; alias: string; fork: true }[]
>;
export function modelAlias(provider: Provider, model: string): string {
  return `tb-${provider}-${createHash("sha256").update(model.toLowerCase()).digest("hex").slice(0, 24)}`;
}
export function mappingRevision(settings: ModelMappings): string {
  return createHash("sha256").update(JSON.stringify(settings)).digest("hex");
}
export function compileAliases(settings: ModelMappings): ModelAliases {
  const aliases: ModelAliases = { codex: [], claude: [], antigravity: [] };
  for (const row of settings.rows)
    for (const provider of providers) {
      const model = row.models[provider];
      if (model)
        aliases[provider].push({
          name: model,
          alias: modelAlias(provider, model),
          fork: true,
        });
    }
  return aliases;
}
export class ModelMappingStore {
  private constructor(
    private readonly path: string,
    private state: ModelMappings,
  ) {}
  static async open(path: string) {
    let state = emptyMappings();
    try {
      state = modelMappingsSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw new Error("모델 매핑 설정 파일을 읽을 수 없습니다.", {
          cause: error,
        });
    }
    return new ModelMappingStore(path, state);
  }
  snapshot(): ModelMappings {
    return structuredClone(this.state);
  }
  async save(input: ModelMappings): Promise<void> {
    const next = modelMappingsSchema.parse(input);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next), {
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
    this.state = next;
  }
}
