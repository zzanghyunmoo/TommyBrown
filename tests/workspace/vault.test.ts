import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { WorkspaceFiles } from "../../src/main/workspace/files";
import { WorkspaceStore } from "../../src/main/workspace/store";
import { VaultService } from "../../src/main/workspace/vault";

const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0))
    await rm(path, { recursive: true, force: true });
});
it("searches local Markdown without hidden metadata or linked directories and validates Obsidian targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-vault-"));
  directories.push(directory);
  const root = join(directory, "vault #1");
  const outside = join(directory, "outside");
  await mkdir(join(root, "notes"), { recursive: true });
  await mkdir(join(root, ".obsidian"));
  await mkdir(outside);
  await writeFile(
    join(root, "notes", "hello.md"),
    "# Offline\n보관함 검색 works locally",
  );
  await writeFile(join(root, ".obsidian", "private.md"), "검색");
  await writeFile(join(outside, "secret.md"), "검색");
  await symlink(
    outside,
    join(root, "escape"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const store = await WorkspaceStore.open(join(directory, "state.json"));
  const state = await store.add(root, "vault");
  const spaceId = state.selectedSpace;
  if (!spaceId) throw new Error("No vault selected");
  const opened: string[] = [];
  const service = new VaultService(
    store,
    new WorkspaceFiles(store),
    async (url) => {
      opened.push(url);
    },
  );
  const result = await service.search({ spaceId, query: "검색" });
  expect(result.matches.map((match) => [match.path, match.line])).toEqual([
    ["notes/hello.md", 2],
  ]);
  expect(result.scanned).toBe(1);
  expect(result.limited).toBe(false);
  await service.open({ spaceId, path: "notes/hello.md" });
  expect(opened).toHaveLength(1);
  const uri = new URL(opened[0] ?? "");
  expect(uri.protocol).toBe("obsidian:");
  expect(uri.hostname).toBe("open");
  expect(uri.searchParams.get("path")).toBe(join(root, "notes", "hello.md"));
  await expect(
    service.open({ spaceId, path: "escape/secret.md" }),
  ).rejects.toThrow(/outside/i);
  const workspace = await store.add(outside, "workspace");
  await expect(
    service.search({ spaceId: workspace.selectedSpace, query: "검색" }),
  ).rejects.toThrow(/vault/i);
});
