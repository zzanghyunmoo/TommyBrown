import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { App } from "electron";
import { afterEach, expect, it } from "vitest";
import { configureDataDirectory } from "../../src/main/data-directory";
import { WorkspaceStore } from "../../src/main/workspace/store";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

function application(base: string, isPackaged: boolean) {
  const paths = new Map([
    ["appData", base],
    ["userData", join(base, "TommyBrown")],
    ["sessionData", join(base, "TommyBrown")],
  ]);
  return {
    isPackaged,
    getPath(name: string) {
      const path = paths.get(name);
      if (!path) throw new Error(`Unexpected path request: ${name}`);
      return path;
    },
    setPath(name: string, path: string) {
      paths.set(name, path);
    },
  } satisfies Pick<App, "getPath" | "setPath" | "isPackaged">;
}

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "tommybrown-profile-"));
  directories.push(base);
  const project = join(base, "project");
  const vault = join(base, "vault");
  await Promise.all([mkdir(project), mkdir(vault)]);
  return { base, project, vault };
}

it("starts a release without development spaces and preserves each profile on restart", async () => {
  const { base, project, vault } = await fixture();
  const development = application(base, false);
  configureDataDirectory(development, undefined);
  const oldState = join(development.getPath("userData"), "workspace.json");
  const oldSpaces = await WorkspaceStore.open(oldState);
  await oldSpaces.add(project, "workspace");
  await oldSpaces.add(vault, "vault");
  const before = await readFile(oldState);
  await writeFile(
    join(development.getPath("sessionData"), "Preferences"),
    "private development session",
  );

  const release = application(base, true);
  configureDataDirectory(release, undefined);
  const newState = join(release.getPath("userData"), "workspace.json");
  const newSpaces = await WorkspaceStore.open(newState);
  expect(newSpaces.snapshot()).toEqual({
    version: 1,
    spaces: [],
    selectedSpace: null,
  });
  await expect(
    readFile(join(release.getPath("sessionData"), "Preferences")),
  ).rejects.toMatchObject({ code: "ENOENT" });

  const saved = await newSpaces.add(project, "workspace");
  const restarted = application(base, true);
  configureDataDirectory(restarted, undefined);
  const restored = await WorkspaceStore.open(
    join(restarted.getPath("userData"), "workspace.json"),
  );
  expect(restored.snapshot()).toEqual(saved);
  expect(await readFile(oldState)).toEqual(before);
  const developmentRestart = application(base, false);
  configureDataDirectory(developmentRestart, undefined);
  expect(developmentRestart.getPath("userData")).toBe(
    development.getPath("userData"),
  );
});

it("uses an explicitly selected data directory for both app state and browser sessions", async () => {
  const { base, vault } = await fixture();
  const custom = join(base, "chosen profile");
  const development = application(base, false);
  configureDataDirectory(development, custom);
  const store = await WorkspaceStore.open(join(custom, "workspace.json"));
  const saved = await store.add(vault, "vault");
  const release = application(base, true);
  configureDataDirectory(release, custom);
  const reopened = await WorkspaceStore.open(
    join(release.getPath("userData"), "workspace.json"),
  );
  expect(reopened.snapshot()).toEqual(saved);
  expect(release.getPath("sessionData")).toBe(custom);
});
