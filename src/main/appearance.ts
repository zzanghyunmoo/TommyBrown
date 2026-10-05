import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type Theme, themeSchema } from "../shared/appearance";

export class AppearanceStore {
  private queue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly path: string,
    private theme: Theme,
  ) {}

  static async open(path: string, fallback: Theme): Promise<AppearanceStore> {
    let theme = fallback;
    try {
      const parsed = themeSchema.safeParse(
        JSON.parse(await readFile(path, "utf8")),
      );
      if (parsed.success) theme = parsed.data;
    } catch (error) {
      if (
        !(error instanceof SyntaxError) &&
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    return new AppearanceStore(path, theme);
  }

  get(): Theme {
    return this.theme;
  }

  set(input: unknown): Promise<Theme> {
    const theme = themeSchema.parse(input);
    const operation = this.queue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(theme), {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporary, this.path);
        this.theme = theme;
        return theme;
      } finally {
        await rm(temporary, { force: true });
      }
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
