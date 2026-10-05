import { describe, expect, it } from "vitest";
import {
  defaultLayout,
  layoutGeometry,
  neighborPane,
  parseLayout,
  removePane,
  resizeSplit,
  splitPane,
  swapPanes,
} from "../../src/renderer/features/workspace/layout";

describe("workbench layout", () => {
  it("keeps three independent surfaces visible by default", () => {
    const { panes } = layoutGeometry(defaultLayout());
    expect(panes.map((pane) => pane.kind)).toEqual([
      "terminal",
      "browser",
      "app",
    ]);
    expect(panes.every((pane) => pane.width > 0 && pane.height > 0)).toBe(true);
    expect(neighborPane(panes, "terminal", "right")).toBe("browser");
    expect(neighborPane(panes, "browser", "down")).toBe("app");
  });
  it("removes a split without dropping the surviving surfaces", () => {
    const split = splitPane(defaultLayout(), "terminal", "vertical", "second");
    const restored = removePane(split, "second");
    expect(restored).toEqual(defaultLayout());
  });
  it("clamps divider proportions instead of hiding a pane", () => {
    const { panes } = layoutGeometry(resizeSplit(defaultLayout(), "root", 2));
    expect(panes[0]?.width).toBe(80);
    expect(panes[1]?.width).toBe(20);
  });
  it("swaps pane locations while preserving identities and content kinds", () => {
    const { panes } = layoutGeometry(
      swapPanes(defaultLayout(), "browser", "app"),
    );
    expect(panes.map((pane) => [pane.id, pane.kind])).toEqual([
      ["terminal", "terminal"],
      ["app", "app"],
      ["browser", "browser"],
    ]);
  });
  it("falls back safely for duplicate or malformed persisted leaves", () => {
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
