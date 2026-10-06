import { afterEach, expect, it, vi } from "vitest";
import {
  defaultLayout,
  openSupport,
  splitPane,
} from "../../src/renderer/features/workspace/layout";
import {
  readViewState,
  saveViewState,
} from "../../src/renderer/features/workspace/view-state";

afterEach(() => vi.unstubAllGlobals());

it("migrates the models page and retains settings categories with workspace state", () => {
  const documents = [
    { spaceId: "11111111-1111-4111-8111-111111111111", path: "draft.md" },
  ];
  let stored = JSON.stringify({ page: "models", documents });
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  });
  expect(readViewState().page).toBe("settings");
  expect(readViewState().settingsSection).toBe("proxy");
  saveViewState({ settingsSection: "mcp", sidebarHidden: true });
  saveViewState({ page: "workspace" });
  expect(readViewState()).toMatchObject({
    page: "workspace",
    settingsSection: "mcp",
    sidebarHidden: true,
    documents,
  });
});

it("migrates forced support panes once while retaining documents and web sessions", () => {
  const spaceId = "11111111-1111-4111-8111-111111111111";
  const layout = splitPane(
    openSupport(defaultLayout(), "browser"),
    "browser",
    "horizontal",
    "app",
    "app",
  );
  const documents = [{ spaceId, path: "note.md" }];
  const browserGroups = {
    browser: {
      tabs: [{ url: "https://example.com/notes", connectorId: null }],
      selected: 0,
    },
    app: {
      tabs: [{ url: "http://localhost:3000", connectorId: null }],
      selected: 0,
    },
  };
  let stored = JSON.stringify({
    layout,
    spaceLayouts: { [spaceId]: layout },
    documents,
    browserGroups,
  });
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  });
  const migrated = readViewState();
  expect(migrated.layoutVersion).toBe(2);
  expect(migrated.spaceLayouts[spaceId]).toEqual(defaultLayout());
  expect(migrated.documents).toEqual(documents);
  expect(migrated.browserGroups).toEqual(browserGroups);
  const reopened = openSupport(defaultLayout(), "app");
  saveViewState({ spaceLayouts: { [spaceId]: reopened } });
  expect(readViewState().spaceLayouts[spaceId]).toEqual(reopened);
  expect(readViewState().browserGroups).toEqual(browserGroups);
});
