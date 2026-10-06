import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LaunchSettingsStore } from "../../src/main/proxy/launch-settings";

const directories: string[] = [];
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "tb-launch-"));
  directories.push(directory);
  const path = join(directory, "launch-settings.json");
  return { directory, path, store: await LaunchSettingsStore.open(path) };
}
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
describe("saved CLI selections", () => {
  it("restores each CLI model and the selected CLI after reopening", async () => {
    const { path, store } = await fixture();
    await store.save({ cli: "claude", model: "fable" });
    await store.save({ cli: "antigravity", model: "astra" });
    const reopened = await LaunchSettingsStore.open(path);
    expect(reopened.snapshot()).toEqual({
      cli: "antigravity",
      models: { claude: "fable", antigravity: "astra", codex: null },
    });
  });
  it("preserves CLI selections when switching to PowerShell", async () => {
    const { store } = await fixture();
    await store.save({ cli: "claude", model: "fable" });
    await store.save({ cli: "powershell", model: null });
    expect(store.snapshot().models.claude).toBe("fable");
  });
  it("serializes simultaneous changes without losing another CLI selection", async () => {
    const { store } = await fixture();
    await Promise.all([
      store.save({ cli: "claude", model: "fable" }),
      store.save({ cli: "codex", model: "astra" }),
    ]);
    expect(store.snapshot().models).toEqual({
      claude: "fable",
      codex: "astra",
      antigravity: null,
    });
  });
  it("keeps the previous selection when persistence fails", async () => {
    const { directory } = await fixture();
    const parent = join(directory, "blocked");
    const store = await LaunchSettingsStore.open(join(parent, "settings.json"));
    await writeFile(parent, "file instead of directory");
    await expect(
      store.save({ cli: "claude", model: "fable" }),
    ).rejects.toThrow();
    expect(store.snapshot().models.claude).toBeNull();
  });
});
