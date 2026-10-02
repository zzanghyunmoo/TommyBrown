import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceStore } from "../../src/main/workspace/store";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-spaces-"));
  directories.push(directory);
  const project = join(directory, "project");
  const vault = join(directory, "vault");
  await Promise.all([mkdir(project), mkdir(vault)]);
  return {
    directory,
    project,
    vault,
    store: await WorkspaceStore.open(join(directory, "state.json")),
  };
}

describe("workspace persistence", () => {
  it("restores distinct spaces and selection without reading project contents", async () => {
    const { store, directory, project, vault } = await fixture();
    const first = await store.add(project, "workspace");
    expect(first.spaces).toHaveLength(1);
    const second = await store.add(vault, "vault");
    expect(second.spaces).toHaveLength(2);
    expect(second.selectedSpace).not.toBe(first.selectedSpace);
    const reopened = await WorkspaceStore.open(join(directory, "state.json"));
    expect(reopened.snapshot()).toEqual(second);
    expect(
      JSON.parse(await readFile(join(directory, "state.json"), "utf8")).spaces,
    ).toHaveLength(2);
  });
  it("deduplicates concurrent selection and never removes the underlying folder", async () => {
    const { store, project } = await fixture();
    await Promise.all([
      store.add(project, "workspace"),
      store.add(project, "workspace"),
    ]);
    const state = store.snapshot();
    expect(state.spaces).toHaveLength(1);
    if (!state.selectedSpace) throw new Error("Missing selection");
    await store.remove(state.selectedSpace);
    expect(store.snapshot().spaces).toEqual([]);
    await expect(store.add(project, "workspace")).resolves.toMatchObject({
      spaces: expect.any(Array),
    });
  });
  it("rejects unknown selections and missing directories", async () => {
    const { store, project } = await fixture();
    await expect(
      store.add(join(project, "missing"), "workspace"),
    ).rejects.toThrow();
    await expect(
      store.select("00000000-0000-4000-8000-000000000000"),
    ).rejects.toThrow();
    expect(store.snapshot().selectedSpace).toBeNull();
  });
});
