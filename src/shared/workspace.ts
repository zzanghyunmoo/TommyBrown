import { z } from "zod";

export const spaceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  root: z.string().min(1),
  kind: z.enum(["workspace", "vault"]),
});
export type Space = z.infer<typeof spaceSchema>;
export const workspaceStateSchema = z.object({
  version: z.literal(1),
  spaces: z.array(spaceSchema),
  selectedSpace: z.uuid().nullable(),
});
export type WorkspaceState = z.infer<typeof workspaceStateSchema>;
export const fileRequestSchema = z.object({
  spaceId: z.uuid(),
  path: z.string().max(4096),
});
export type FileRequest = z.infer<typeof fileRequestSchema>;
export const saveRequestSchema = fileRequestSchema.extend({
  content: z.string().max(2 * 1024 * 1024),
  version: z.string().regex(/^[a-f0-9]{64}$/),
});
export type SaveRequest = z.infer<typeof saveRequestSchema>;
export type FileEntry = {
  readonly name: string;
  readonly path: string;
  readonly kind: "directory" | "file";
};
export type TextDocument = FileRequest & {
  readonly content: string;
  readonly version: string;
};
export type VaultSearchResult = {
  readonly matches: readonly {
    readonly path: string;
    readonly line: number;
    readonly excerpt: string;
  }[];
  readonly scanned: number;
  readonly skipped: number;
  readonly limited: boolean;
};

export interface WorkspaceBridge {
  readonly searchVault: (request: {
    readonly spaceId: string;
    readonly query: string;
  }) => Promise<VaultSearchResult>;
  readonly openObsidian: (request: FileRequest) => Promise<void>;
  readonly setDirty: (dirty: boolean) => Promise<void>;
  readonly snapshot: () => Promise<WorkspaceState>;
  readonly chooseSpace: (kind: Space["kind"]) => Promise<WorkspaceState>;
  readonly selectSpace: (id: string) => Promise<WorkspaceState>;
  readonly removeSpace: (id: string) => Promise<WorkspaceState>;
  readonly list: (request: FileRequest) => Promise<readonly FileEntry[]>;
  readonly read: (request: FileRequest) => Promise<TextDocument>;
  readonly save: (request: SaveRequest) => Promise<TextDocument>;
}

declare global {
  interface Window {
    readonly workspace: WorkspaceBridge;
  }
}
