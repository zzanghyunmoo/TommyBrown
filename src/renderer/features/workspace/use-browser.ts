import { useCallback, useEffect, useState } from "react";
import type { BrowserState } from "../../../shared/browser";
import { readViewState, saveViewState } from "./view-state";

function persist(group: string, state: BrowserState) {
  saveViewState({
    browserGroups: {
      ...readViewState().browserGroups,
      [group]: {
        tabs: state.tabs.map(({ url, connectorId }) => ({ url, connectorId })),
        selected: Math.max(
          0,
          state.tabs.findIndex((tab) => tab.id === state.selected),
        ),
      },
    },
  });
}

export function useBrowser(group = "browser") {
  const [state, setState] = useState<BrowserState>({
    tabs: [],
    selected: null,
  });
  const [error, setError] = useState<string>();
  const accept = useCallback(
    (next: BrowserState) => {
      setState((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      persist(group, next);
    },
    [group],
  );
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await window.browser.snapshot(group);
        if (active) accept(next);
      } catch (failure) {
        if (active && failure instanceof Error) setError(failure.message);
      } finally {
        if (active)
          timer = setTimeout(() => {
            void poll();
          }, 750);
      }
    }
    async function restore() {
      const saved = readViewState();
      const previous =
        saved.browserGroups[group] ??
        (group === "browser"
          ? { tabs: saved.webTabs, selected: saved.selectedWeb }
          : undefined);
      try {
        const existing = await window.browser.snapshot(group);
        if (active && existing.tabs.length === 0 && previous?.tabs.length) {
          const restored: string[] = [];
          for (const tab of previous.tabs) {
            if (!active) return;
            try {
              const next = await window.browser.open(
                tab.url,
                tab.connectorId,
                group,
              );
              if (next.selected) restored.push(next.selected);
            } catch (failure) {
              if (active && failure instanceof Error) setError(failure.message);
            }
          }
          const selected = restored[previous.selected];
          if (active && selected) await window.browser.select(selected);
        }
      } catch (failure) {
        if (active && failure instanceof Error) setError(failure.message);
      }
      if (active) await poll();
    }
    void restore();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [group, accept]);
  const run = useCallback(
    async (action: () => Promise<BrowserState> | Promise<void>) => {
      setError(undefined);
      try {
        const next = await action();
        if (next) accept(next);
      } catch (failure) {
        if (failure instanceof Error) setError(failure.message);
      }
    },
    [accept],
  );
  return {
    state,
    error,
    run,
    group,
    selected: state.tabs.find((tab) => tab.id === state.selected),
    open: (url: string, connectorId: string | null = null) =>
      run(() => window.browser.open(url, connectorId, group)),
  };
}
