import { describe, expect, it } from "vitest";
import {
  defaultLayout,
  layoutGeometry,
  neighborPane,
  openSupport,
  parseLayout,
  removePane,
  resizeSplit,
  splitPane,
  swapPanes,
  workingLayout,
} from "../../src/renderer/features/workspace/layout";

describe("workbench layout", () => {
  it("starts with one full-width working area and opens support on the right", () => {
    const { panes } = layoutGeometry(defaultLayout());
    expect(panes.map((pane) => pane.kind)).toEqual(["terminal"]);
    expect(panes[0]?.width).toBe(100);
    expect(panes.every((pane) => pane.width > 0 && pane.height > 0)).toBe(true);
    const split = openSupport(defaultLayout(), "browser");
    expect(neighborPane(layoutGeometry(split).panes, "terminal", "right")).toBe(
      "browser",
    );
    const switched = openSupport(split, "app");
    expect(layoutGeometry(switched).panes.map((pane) => pane.kind)).toEqual([
      "terminal",
      "app",
    ]);
    expect(workingLayout(switched)).toEqual(defaultLayout());
  });
  it("migrates forced support panes while retaining explicit terminal splits", () => {
    const work = splitPane(defaultLayout(), "terminal", "horizontal", "second");
    const legacy = splitPane(
      openSupport(work, "browser"),
      "browser",
      "horizontal",
      "app",
      "app",
    );
    expect(workingLayout(legacy)).toEqual(work);
    expect(parseLayout(openSupport(work, "app"))).toEqual(
      openSupport(work, "app"),
    );
  });
  it("removes a split without dropping the surviving surfaces", () => {
    const split = splitPane(defaultLayout(), "terminal", "vertical", "second");
    const restored = removePane(split, "second");
    expect(restored).toEqual(defaultLayout());
  });
  it("clamps divider proportions instead of hiding a pane", () => {
    const { panes } = layoutGeometry(
      resizeSplit(openSupport(defaultLayout(), "browser"), "support-root", 2),
    );
    expect(panes[0]?.width).toBe(80);
    expect(panes[1]?.width).toBe(20);
  });
  it("swaps pane locations while preserving identities and content kinds", () => {
    const { panes } = layoutGeometry(
      swapPanes(openSupport(defaultLayout(), "browser"), "browser", "terminal"),
    );
    expect(panes.map((pane) => [pane.id, pane.kind])).toEqual([
      ["browser", "browser"],
      ["terminal", "terminal"],
    ]);
  });
  it("falls back safely for duplicate or malformed persisted leaves", () => {
    const legacy = splitPane(
      { kind: "terminal", id: "old" },
      "old",
      "horizontal",
      "second",
    );
    const migrated = workingLayout(legacy);
    expect(layoutGeometry(migrated).panes.map((pane) => pane.id)).toEqual([
      "terminal",
      "second",
    ]);
    expect(parseLayout(migrated)).toEqual(migrated);
    const invalid = {
      kind: "split",
      id: "root",
      axis: "horizontal",
      ratio: 0.5,
      first: { kind: "terminal", id: "same" },
      second: { kind: "browser", id: "same" },
    };
    expect(parseLayout(invalid)).toEqual(defaultLayout());
    expect(parseLayout({ kind: "app", id: "random" })).toEqual(defaultLayout());
    expect(parseLayout({ kind: "terminal", id: "browser" })).toEqual(
      defaultLayout(),
    );
    expect(parseLayout({ kind: "terminal", id: "only" })).toEqual({
      kind: "terminal",
      id: "only",
    });
  });
});
