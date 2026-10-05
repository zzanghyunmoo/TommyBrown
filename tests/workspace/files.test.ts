import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceFiles } from "../../src/main/workspace/files";
import { WorkspaceStore } from "../../src/main/workspace/store";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-files-"));
  directories.push(directory);
  const root = join(directory, "root");
  await mkdir(root);
  const store = await WorkspaceStore.open(join(directory, "state.json"));
  const state = await store.add(root, "workspace");
  if (!state.selectedSpace) throw new Error("Missing selection");
  return {
    directory,
    root,
    spaceId: state.selectedSpace,
    files: new WorkspaceFiles(store),
  };
}

describe("workspace file boundaries", () => {
  it("lists, reads, and saves UTF-8 documents with an optimistic version", async () => {
    const { root, spaceId, files } = await fixture();
    await writeFile(join(root, "note.md"), "# 안녕하세요\n");
    const entries = await files.list({ spaceId, path: "" });
    expect(entries).toEqual([
      { name: "note.md", path: "note.md", kind: "file" },
    ]);
    const doc = await files.read({ spaceId, path: "note.md" });
    const saved = await files.save({ ...doc, content: "# 저장됨\n" });
    expect(saved.version).not.toBe(doc.version);
    expect(await readFile(join(root, "note.md"), "utf8")).toBe("# 저장됨\n");
  });
  it("refuses stale writes instead of overwriting an external edit", async () => {
    const { root, spaceId, files } = await fixture();
    const path = join(root, "note.md");
    await writeFile(path, "original");
    const doc = await files.read({ spaceId, path: "note.md" });
    await writeFile(path, "external change");
    await expect(files.save({ ...doc, content: "my draft" })).rejects.toThrow(
      /changed/i,
    );
    expect(await readFile(path, "utf8")).toBe("external change");
  });
  it("rejects traversal, absolute paths, streams, and directory links outside the root", async () => {
    const { directory, root, spaceId, files } = await fixture();
    const outside = join(directory, "outside");
    await mkdir(join(root, ".git"));
    await writeFile(join(root, ".git", "config"), "private Git metadata");
    await mkdir(outside);
    await writeFile(join(outside, "secret.md"), "outside");
    await symlink(
      outside,
      join(root, "escape"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const path of [
      "../outside/secret.md",
      join(outside, "secret.md"),
      "note.md:stream",
      "escape/secret.md",
      ".git/config",
      ".GIT/config",
    ]) {
      await expect(files.read({ spaceId, path })).rejects.toThrow();
    }
    expect(await files.list({ spaceId, path: "" })).toEqual([]);
  });
  it("refuses binary and oversized files without truncating them", async () => {
    const { root, spaceId, files } = await fixture();
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 255, 0]));
    await writeFile(
      join(root, "large.txt"),
      Buffer.alloc(2 * 1024 * 1024 + 1, 65),
    );
    await expect(files.read({ spaceId, path: "binary.bin" })).rejects.toThrow(
      /text/i,
    );
    await expect(files.read({ spaceId, path: "large.txt" })).rejects.toThrow(
      /large/i,
    );
  });
});
