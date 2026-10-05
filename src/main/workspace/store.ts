import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname } from "node:path";
import { z } from "zod";
import {
  type Space,
  type WorkspaceState,
  workspaceStateSchema,
} from "../../shared/workspace";

export class WorkspaceStore {
  private queue: Promise<void> = Promise.resolve();
  private constructor(
    private readonly path: string,
    private state: WorkspaceState,
  ) {}

  static async open(path: string): Promise<WorkspaceStore> {
    let state: WorkspaceState = { version: 1, spaces: [], selectedSpace: null };
    try {
      state = workspaceStateSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    return new WorkspaceStore(path, state);
  }

  snapshot(): WorkspaceState {
    return structuredClone(this.state);
  }

  requireSpace(id: string): Space {
    const space = this.state.spaces.find(
      (candidate) => candidate.id === z.uuid().parse(id),
    );
    if (!space) throw new Error("This space is no longer available.");
    return { ...space };
  }

  add(directory: string, inputKind: Space["kind"]): Promise<WorkspaceState> {
    return this.mutate(async (state) => {
      const root = await realpath(directory);
      if (!(await stat(root)).isDirectory())
        throw new Error("Choose a directory for this space.");
      const kind = z.enum(["workspace", "vault"]).parse(inputKind);
      const canonical = (path: string) =>
        process.platform === "win32" ? path.toLowerCase() : path;
      const existing = state.spaces.find(
        (space) =>
          canonical(space.root) === canonical(root) && space.kind === kind,
      );
      if (existing) return { ...state, selectedSpace: existing.id };
      const space: Space = {
        id: randomUUID(),
        name: basename(root) || root,
        root,
        kind,
      };
      return {
        ...state,
        spaces: [...state.spaces, space],
        selectedSpace: space.id,
      };
    });
  }

  select(id: string): Promise<WorkspaceState> {
    return this.mutate(async (state) => ({
      ...state,
      selectedSpace: this.requireSpace(id).id,
    }));
  }

  remove(id: string): Promise<WorkspaceState> {
    return this.mutate(async (state) => {
      this.requireSpace(id);
      const spaces = state.spaces.filter((space) => space.id !== id);
      return {
        ...state,
        spaces,
        selectedSpace:
          state.selectedSpace === id
            ? (spaces[0]?.id ?? null)
            : state.selectedSpace,
      };
    });
  }

  private mutate(
    change: (state: WorkspaceState) => Promise<WorkspaceState>,
  ): Promise<WorkspaceState> {
    const operation = this.queue.then(async () => {
      const next = workspaceStateSchema.parse(await change(this.snapshot()));
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
      return this.snapshot();
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
