import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { AppearanceStore } from "../../src/main/appearance";

const directories: string[] = [];
async function location(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-appearance-"));
  directories.push(directory);
  return join(directory, "appearance.json");
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it("persists explicit choices in order and ignores a different OS default on restart", async () => {
  const path = await location();
  const store = await AppearanceStore.open(path, "light");
  expect(store.get()).toBe("light");
  await Promise.all([store.set("light"), store.set("dark")]);
  expect((await AppearanceStore.open(path, "light")).get()).toBe("dark");
  expect(JSON.parse(await readFile(path, "utf8"))).toBe("dark");
  expect(() => store.set("not-a-theme")).toThrow();
  expect(store.get()).toBe("dark");
});

it("recovers invalid cosmetic preferences using the OS default", async () => {
  const path = await location();
  for (const value of ["broken JSON", '{"theme":"unknown"}']) {
    await writeFile(path, value);
    expect((await AppearanceStore.open(path, "dark")).get()).toBe("dark");
  }
});

it("keeps the current theme when a write fails", async () => {
  const parent = await location();
  const store = await AppearanceStore.open(join(parent, "theme.json"), "light");
  await writeFile(parent, "blocks the settings directory");
  await expect(store.set("dark")).rejects.toThrow();
  expect(store.get()).toBe("light");
});
