import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  defaultLaunchSettings,
  type LaunchSettings,
  launchSelectionSchema,
  launchSettingsSchema,
} from "../../shared/launch-settings";

export class LaunchSettingsStore {
  private queue: Promise<void> = Promise.resolve();
  private constructor(
    private readonly path: string,
    private state: LaunchSettings,
  ) {}
  static async open(path: string) {
    let state = defaultLaunchSettings();
    try {
      state = launchSettingsSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    return new LaunchSettingsStore(path, state);
  }
  snapshot(): LaunchSettings {
    return structuredClone(this.state);
  }
  save(input: unknown): Promise<LaunchSettings> {
    const selection = launchSelectionSchema.parse(input);
    const operation = this.queue.then(async () => {
      const next = {
        cli: selection.cli,
        models:
          selection.cli === "powershell"
            ? this.state.models
            : { ...this.state.models, [selection.cli]: selection.model },
      };
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(next), {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporary, this.path);
        this.state = next;
      } finally {
        await rm(temporary, { force: true });
      }
      return this.snapshot();
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
