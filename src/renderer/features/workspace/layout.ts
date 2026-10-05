import { z } from "zod";

export type Direction = "left" | "down" | "up" | "right";
export type PaneKind = "terminal" | "browser" | "app";
export type Pane = { readonly id: string; readonly kind: PaneKind };
export type Layout =
  | Pane
  | {
      readonly kind: "split";
      readonly id: string;
      readonly axis: "vertical" | "horizontal";
      readonly ratio: number;
      readonly first: Layout;
      readonly second: Layout;
    };
export type Rectangle = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type PaneRectangle = Pane & Rectangle;
export type Divider = Rectangle & {
  readonly id: string;
  readonly axis: "vertical" | "horizontal";
  readonly ratio: number;
};
const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9-]+$/);
const layoutSchema: z.ZodType<Layout> = z.lazy(() =>
  z.union([
    z.object({ id: idSchema, kind: z.enum(["terminal", "browser", "app"]) }),
    z.object({
      id: idSchema,
      kind: z.literal("split"),
      axis: z.enum(["vertical", "horizontal"]),
      ratio: z.number().min(0.2).max(0.8),
      first: layoutSchema,
      second: layoutSchema,
    }),
  ]),
);

export function defaultLayout(): Layout {
  return { kind: "terminal", id: "terminal" };
}

export function workingLayout(layout: Layout): Layout {
  function withoutSupport(node: Layout): Layout | null {
    if (node.kind !== "split") return node.kind === "terminal" ? node : null;
    const first = withoutSupport(node.first);
    const second = withoutSupport(node.second);
    return first && second ? { ...node, first, second } : (first ?? second);
  }
  const work = withoutSupport(layout) ?? defaultLayout();
  if (layoutGeometry(work).panes.some((pane) => pane.id === "terminal"))
    return work;
  function primary(node: Layout): Layout {
    return node.kind === "split"
      ? { ...node, first: primary(node.first) }
      : defaultLayout();
  }
  return primary(work);
}

export function openSupport(layout: Layout, kind: "browser" | "app"): Layout {
  if (
    layout.kind === "split" &&
    layout.second.kind !== "split" &&
    layout.second.kind !== "terminal"
  )
    return { ...layout, second: { kind, id: kind } };
  return {
    kind: "split",
    id: "support-root",
    axis: "vertical",
    ratio: 0.6,
    first: workingLayout(layout),
    second: { kind, id: kind },
  };
}

export function parseLayout(value: unknown): Layout {
  // Persisted input is bounded before recursive parsing, including corrupt deep trees.
  const pending: unknown[] = [value];
  let count = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++count > 15) return defaultLayout();
    if (
      item &&
      typeof item === "object" &&
      "kind" in item &&
      item.kind === "split"
    ) {
      if ("first" in item) pending.push(item.first);
      if ("second" in item) pending.push(item.second);
    }
  }
  const result = layoutSchema.safeParse(value);
  if (!result.success) return defaultLayout();
  const { panes, dividers } = layoutGeometry(result.data);
  const ids = [...panes, ...dividers].map(({ id }) => id);
  const validKinds = panes.every((pane) =>
    pane.kind === "terminal"
      ? pane.id !== "browser" && pane.id !== "app"
      : pane.id === pane.kind,
  );
  return new Set(ids).size === ids.length && panes.length <= 8 && validKinds
    ? result.data
    : defaultLayout();
}

export function layoutGeometry(layout: Layout): {
  readonly panes: readonly PaneRectangle[];
  readonly dividers: readonly Divider[];
} {
  const panes: PaneRectangle[] = [];
  const dividers: Divider[] = [];
  function visit(node: Layout, area: Rectangle) {
    if (node.kind !== "split") {
      panes.push({ ...node, ...area });
      return;
    }
    dividers.push({ ...area, id: node.id, axis: node.axis, ratio: node.ratio });
    if (node.axis === "vertical") {
      const width = area.width * node.ratio;
      visit(node.first, { ...area, width });
      visit(node.second, {
        ...area,
        x: area.x + width,
        width: area.width - width,
      });
    } else {
      const height = area.height * node.ratio;
      visit(node.first, { ...area, height });
      visit(node.second, {
        ...area,
        y: area.y + height,
        height: area.height - height,
      });
    }
  }
  visit(layout, { x: 0, y: 0, width: 100, height: 100 });
  return { panes, dividers };
}

export function splitPane(
  layout: Layout,
  id: string,
  axis: "vertical" | "horizontal",
  newId: string,
  kind: PaneKind = "terminal",
): Layout {
  if (layout.id === id)
    return {
      kind: "split",
      id: `split-${newId}`,
      axis,
      ratio: 0.5,
      first: layout,
      second: { kind, id: newId },
    };
  if (layout.kind !== "split") return layout;
  return {
    ...layout,
    first: splitPane(layout.first, id, axis, newId, kind),
    second: splitPane(layout.second, id, axis, newId, kind),
  };
}

export function removePane(layout: Layout, id: string): Layout {
  if (layout.kind !== "split") return layout;
  if (layout.first.id === id) return layout.second;
  if (layout.second.id === id) return layout.first;
  return {
    ...layout,
    first: removePane(layout.first, id),
    second: removePane(layout.second, id),
  };
}

export function resizeSplit(layout: Layout, id: string, ratio: number): Layout {
  if (layout.kind !== "split") return layout;
  if (layout.id === id)
    return { ...layout, ratio: Math.max(0.2, Math.min(0.8, ratio)) };
  return {
    ...layout,
    first: resizeSplit(layout.first, id, ratio),
    second: resizeSplit(layout.second, id, ratio),
  };
}

export function swapPanes(
  layout: Layout,
  firstId: string,
  secondId: string,
): Layout {
  const { panes } = layoutGeometry(layout);
  const first = panes.find(({ id }) => id === firstId);
  const second = panes.find(({ id }) => id === secondId);
  if (!first || !second) return layout;
  const firstKind = first.kind;
  const secondKind = second.kind;
  function replace(node: Layout): Layout {
    if (node.kind === "split")
      return {
        ...node,
        first: replace(node.first),
        second: replace(node.second),
      };
    if (node.id === firstId) return { id: secondId, kind: secondKind };
    if (node.id === secondId) return { id: firstId, kind: firstKind };
    return node;
  }
  return replace(layout);
}

export function neighborPane(
  panes: readonly PaneRectangle[],
  id: string,
  direction: Direction,
): string | undefined {
  const from = panes.find((pane) => pane.id === id);
  if (!from) return undefined;
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const centerX = from.x + from.width / 2;
  const centerY = from.y + from.height / 2;
  return panes
    .filter((pane) => pane.id !== id)
    .map((pane) => {
      const dx = pane.x + pane.width / 2 - centerX;
      const dy = pane.y + pane.height / 2 - centerY;
      const primary = (horizontal ? dx : dy) * sign;
      const secondary = Math.abs(horizontal ? dy : dx);
      return { id: pane.id, primary, score: primary + secondary * 2 };
    })
    .filter((item) => item.primary > 0.01)
    .sort((a, b) => a.score - b.score)[0]?.id;
}
