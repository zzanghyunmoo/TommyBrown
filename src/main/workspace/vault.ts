import { z } from "zod";
import type { FileEntry, VaultSearchResult } from "../../shared/workspace";
import { fileRequestSchema } from "../../shared/workspace";
import type { WorkspaceFiles } from "./files";
import type { WorkspaceStore } from "./store";

export class VaultService {
  constructor(
    private readonly spaces: WorkspaceStore,
    private readonly files: WorkspaceFiles,
    private readonly openExternal: (url: string) => Promise<void>,
  ) {}

  async search(input: unknown): Promise<VaultSearchResult> {
    const { spaceId, query } = z
      .object({
        spaceId: z.uuid(),
        query: z.string().trim().min(1).max(200),
      })
      .parse(input);
    this.requireVault(spaceId);
    const needle = query.toLocaleLowerCase();
    const matches: VaultSearchResult["matches"][number][] = [];
    const pending = [""];
    let scanned = 0;
    let bytes = 0;
    let skipped = 0;
    let entriesSeen = 0;
    while (pending.length) {
      const directory = pending.pop();
      if (directory === undefined) break;
      let entries: readonly FileEntry[];
      try {
        entries = await this.files.list({ spaceId, path: directory });
      } catch {
        skipped++;
        continue;
      }
      for (const entry of entries) {
        entriesSeen++;
        if (
          entriesSeen > 10000 ||
          scanned >= 5000 ||
          bytes >= 50 * 1024 * 1024 ||
          matches.length >= 100
        )
          return { matches, scanned, skipped, limited: true };
        if (entry.name.startsWith(".")) continue;
        if (entry.kind === "directory") {
          pending.push(entry.path);
          continue;
        }
        if (!/\.md$/i.test(entry.name)) continue;
        scanned++;
        try {
          const doc = await this.files.read({ spaceId, path: entry.path });
          bytes += Buffer.byteLength(doc.content, "utf8");
          const offset = doc.content.toLocaleLowerCase().indexOf(needle);
          if (offset < 0 && !entry.path.toLocaleLowerCase().includes(needle))
            continue;
          const start = Math.max(0, offset - 50);
          matches.push({
            path: entry.path,
            line:
              offset < 0 ? 1 : doc.content.slice(0, offset).split("\n").length,
            excerpt: doc.content.slice(start, start + 180).replace(/\s+/g, " "),
          });
        } catch {
          skipped++;
        }
      }
    }
    return { matches, scanned, skipped, limited: false };
  }

  async open(input: unknown): Promise<void> {
    const request = fileRequestSchema.parse(input);
    this.requireVault(request.spaceId);
    const path = await this.files.resolve(request);
    if (request.path && !/\.md$/i.test(path))
      throw new Error("Choose a Markdown note to open in Obsidian.");
    const url = new URL("obsidian://open");
    url.searchParams.set("path", path);
    await this.openExternal(url.href);
  }

  private requireVault(spaceId: string): void {
    if (this.spaces.requireSpace(spaceId).kind !== "vault")
      throw new Error("Choose an Obsidian vault first.");
  }
}
