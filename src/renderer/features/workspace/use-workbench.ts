import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type {
  WorkbenchCommand,
  WorkbenchEvent,
} from "../../../shared/workbench";
import type { Space } from "../../../shared/workspace";
import {
  type Direction,
  type Layout,
  layoutGeometry,
  neighborPane,
  type PaneKind,
  parseLayout,
  removePane,
  resizeSplit,
  splitPane,
  swapPanes,
} from "./layout";
import type { PaneHandle } from "./pane-handle";
import type { useTerminals } from "./use-terminals";
import { readViewState, saveViewState } from "./view-state";

const focusDirections: Readonly<Record<string, Direction>> = {
  "focus-left": "left",
  "focus-down": "down",
  "focus-up": "up",
  "focus-right": "right",
};
const swapDirections: Readonly<Record<string, Direction>> = {
  "swap-left": "left",
  "swap-down": "down",
  "swap-up": "up",
  "swap-right": "right",
};
const resizeDirections: Readonly<Record<string, Direction>> = {
  "resize-left": "left",
  "resize-down": "down",
  "resize-up": "up",
  "resize-right": "right",
};

export function useWorkbench({
  space,
  terminals,
  visible,
  toggleSidebar,
  openSpace,
}: {
  readonly space: Space;
  readonly terminals: ReturnType<typeof useTerminals>;
  readonly visible: boolean;
  readonly toggleSidebar: () => void;
  readonly openSpace: () => void;
}) {
  const [layouts, setLayouts] = useState<Readonly<Record<string, Layout>>>(
    () => {
      const saved = readViewState();
      return Object.fromEntries(
        Object.entries(saved.spaceLayouts).map(([id, value]) => [
          id,
          parseLayout(value),
        ]),
      );
    },
  );
  const layout = layouts[space.id] ?? parseLayout(readViewState().layout);
  function setLayout(update: (current: Layout) => Layout) {
    setLayouts((current) => ({
      ...current,
      [space.id]: update(current[space.id] ?? layout),
    }));
  }
  const [active, setActive] = useState("terminal");
  const [zoom, setZoom] = useState<string | null>(null);
  const [layoutSpace, setLayoutSpace] = useState(space.id);
  if (layoutSpace !== space.id) {
    setLayoutSpace(space.id);
    setZoom(null);
  }
  const [owners, setOwners] = useState<Readonly<Record<string, string>>>({});
  const [dialog, setDialog] = useState<"help" | "spaces" | "sessions" | null>(
    null,
  );
  const [mode, setMode] = useState("idle");
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<string, PaneHandle>());
  const pendingLaunch = useRef(new Set<string>());
  const { panes, dividers } = layoutGeometry(layout);
  const defaultTerminal =
    panes.find((pane) => pane.kind === "terminal")?.id ?? "terminal";
  const focused = panes.some((pane) => pane.id === active)
    ? active
    : (panes[0]?.id ?? "terminal");
  const report = useCallback((failure: unknown) => {
    if (failure instanceof Error) setError(failure.message);
  }, []);
  useEffect(() => {
    try {
      saveViewState({ spaceLayouts: layouts });
    } catch (failure) {
      report(failure);
    }
  }, [layouts, report]);
  useEffect(() => {
    for (const id of pendingLaunch.current) {
      const handle = handles.current.get(id);
      if (handle) {
        pendingLaunch.current.delete(id);
        handle.newTab();
      }
    }
  });
  useEffect(() => {
    void window.workbench.enable(visible && !dialog).catch(report);
    return () => {
      void window.workbench.enable(false).catch(report);
    };
  }, [visible, dialog, report]);
  const selectedSession = terminals.sessions.find(
    (session) =>
      session.id === terminals.selected && session.spaceId === space.id,
  );
  const selectedPane = selectedSession
    ? (owners[selectedSession.id] ?? defaultTerminal)
    : undefined;
  useEffect(() => {
    if (terminals.selection && selectedPane && visible) {
      setActive(selectedPane);
      requestAnimationFrame(() => handles.current.get(selectedPane)?.focus());
    }
  }, [selectedPane, terminals.selection, visible]);
  function focus(id: string) {
    setActive(id);
    if (zoom) setZoom(id);
    requestAnimationFrame(() => handles.current.get(id)?.focus());
  }
  function ensure(kind: PaneKind) {
    const found = panes.find((pane) => pane.kind === kind);
    if (found) {
      focus(found.id);
      return found.id;
    }
    if (panes.length >= 8) {
      setError(
        "패널은 최대 8개까지 열 수 있습니다. 사용하지 않는 패널을 먼저 닫으세요.",
      );
      return undefined;
    }
    const id = kind === "terminal" ? crypto.randomUUID() : kind;
    if (kind === "terminal") pendingLaunch.current.add(id);
    setLayout((current) => splitPane(current, focused, "vertical", id, kind));
    setZoom(null);
    setActive(id);
    return id;
  }
  function split(axis: "vertical" | "horizontal", source: string) {
    const pane = panes.find((item) => item.id === source);
    const bounds = canvas.current?.getBoundingClientRect();
    if (!pane || !bounds) return;
    if (
      panes.length >= 8 ||
      (axis === "vertical"
        ? (bounds.width * pane.width) / 200 < 240
        : (bounds.height * pane.height) / 200 < 160)
    ) {
      setError(
        "분할할 공간이 부족합니다. 창이나 패널을 넓힌 뒤 다시 시도하세요.",
      );
      return;
    }
    const id = crypto.randomUUID();
    pendingLaunch.current.add(id);
    setLayout((current) => splitPane(current, source, axis, id));
    setZoom(null);
    setActive(id);
    setError(undefined);
  }
  async function closePane(id: string) {
    const pane = panes.find((item) => item.id === id);
    if (!pane) return;
    if (panes.length === 1) {
      handles.current.get(id)?.closeTab();
      return;
    }
    if (pane.kind === "terminal") {
      const sessions = terminals.sessions.filter(
        (session) =>
          session.spaceId === space.id &&
          (owners[session.id] ?? defaultTerminal) === id,
      );
      if (
        sessions.some((session) => session.phase === "running") &&
        !window.confirm("이 패널의 실행 중인 세션을 종료할까요?")
      )
        return;
      for (const session of sessions)
        if (!(await terminals.close(session.id))) return;
    }
    setLayout((current) => removePane(current, id));
    const next = panes.find((item) => item.id !== id);
    if (next) focus(next.id);
    setZoom(null);
  }
  function resize(id: string, ratio: number) {
    setLayout((current) => resizeSplit(current, id, ratio));
  }
  function resizeFocused(direction: Direction, id: string) {
    const pane = panes.find((item) => item.id === id);
    if (!pane) return;
    const axis =
      direction === "left" || direction === "right" ? "vertical" : "horizontal";
    const divider = [...dividers]
      .reverse()
      .find(
        (item) =>
          item.axis === axis &&
          pane.x >= item.x &&
          pane.y >= item.y &&
          pane.x + pane.width <= item.x + item.width + 0.001 &&
          pane.y + pane.height <= item.y + item.height + 0.001,
      );
    if (divider)
      resize(
        divider.id,
        divider.ratio +
          (direction === "right" || direction === "down" ? 0.05 : -0.05),
      );
  }
  function command(action: WorkbenchCommand, source = focused) {
    setActive(source);
    const direction = focusDirections[action];
    if (direction) {
      const next = neighborPane(panes, source, direction);
      if (next) focus(next);
      return;
    }
    const swap = swapDirections[action];
    if (swap) {
      const next = neighborPane(panes, source, swap);
      if (next) setLayout((current) => swapPanes(current, source, next));
      return;
    }
    const resizeDirection = resizeDirections[action];
    if (resizeDirection) {
      resizeFocused(resizeDirection, source);
      return;
    }
    const handle = handles.current.get(source);
    if (action.startsWith("tab-")) {
      handle?.selectTab(Number(action.slice(4)) - 1);
      return;
    }
    switch (action) {
      case "new-tab":
        handle?.newTab();
        break;
      case "close-tab":
        handle?.closeTab();
        break;
      case "next-tab":
        handle?.cycleTab(1);
        break;
      case "previous-tab":
        handle?.cycleTab(-1);
        break;
      case "split-right":
        split("vertical", source);
        break;
      case "split-down":
        split("horizontal", source);
        break;
      case "close-pane":
        void closePane(source);
        break;
      case "zoom":
        setZoom((current) => (current === source ? null : source));
        requestAnimationFrame(() => handle?.focus());
        break;
      case "sidebar":
        toggleSidebar();
        break;
      case "workspaces":
        setDialog("spaces");
        break;
      case "sessions":
        setDialog("sessions");
        break;
      case "new-workspace":
        openSpace();
        break;
      case "help":
        setDialog("help");
        break;
      case "resize":
        setZoom(null);
        break;
      default:
        break;
    }
  }
  const event = useEffectEvent((input: WorkbenchEvent) => {
    if (!visible) return;
    switch (input.type) {
      case "mode":
        setMode(input.mode);
        break;
      case "focus":
        if (panes.some((pane) => pane.id === input.group))
          setActive(input.group);
        break;
      case "command":
        command(input.command, input.group ?? focused);
        break;
    }
  });
  useEffect(() => window.workbench.onEvent((input) => event(input)), []);
  function closeDialog() {
    setDialog(null);
    requestAnimationFrame(() => handles.current.get(focused)?.focus());
  }
  function scopedTerminals(id: string) {
    return {
      ...terminals,
      sessions: terminals.sessions.filter(
        (session) => (owners[session.id] ?? defaultTerminal) === id,
      ),
      launch: async (request: Parameters<typeof terminals.launch>[0]) => {
        const session = await terminals.launch(request);
        if (session) setOwners((current) => ({ ...current, [session.id]: id }));
        return session;
      },
    };
  }
  return {
    panes,
    dividers,
    focused,
    zoom,
    mode,
    error,
    setError,
    canvas,
    handles,
    dragging,
    setDragging,
    dialog,
    setDialog,
    closeDialog,
    focus,
    setActive,
    ensure,
    command,
    resize,
    closePane,
    scopedTerminals,
    boundsKey: JSON.stringify(layout),
  };
}
