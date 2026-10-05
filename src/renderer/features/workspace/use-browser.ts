import { useCallback, useEffect, useState } from "react";
import type { BrowserState } from "../../../shared/browser";
import { readViewState, saveViewState } from "./view-state";

export function useBrowser() {
  const [state, setState] = useState<BrowserState>({
    tabs: [],
    selected: null,
  });
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await window.browser.snapshot();
        if (active) {
          setState(next);
          saveViewState({
            webTabs: next.tabs.map(({ url, connectorId }) => ({
              url,
              connectorId,
            })),
            selectedWeb: Math.max(
              0,
              next.tabs.findIndex((tab) => tab.id === next.selected),
            ),
          });
        }
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
      try {
        const existing = await window.browser.snapshot();
        if (existing.tabs.length === 0 && saved.webTabs.length) {
          const restored: string[] = [];
          for (const tab of saved.webTabs) {
            try {
              const next = await window.browser.open(tab.url, tab.connectorId);
              if (next.selected) restored.push(next.selected);
            } catch (failure) {
              if (active && failure instanceof Error) setError(failure.message);
            }
          }
          const selected = restored[saved.selectedWeb];
          if (selected) await window.browser.select(selected);
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
  }, []);
  const run = useCallback(
    async (action: () => Promise<BrowserState> | Promise<void>) => {
      setError(undefined);
      try {
        const next = await action();
        if (next) {
          setState(next);
          saveViewState({
            webTabs: next.tabs.map(({ url, connectorId }) => ({
              url,
              connectorId,
            })),
            selectedWeb: Math.max(
              0,
              next.tabs.findIndex((tab) => tab.id === next.selected),
            ),
          });
        }
      } catch (failure) {
        if (failure instanceof Error) setError(failure.message);
      }
    },
    [],
  );
  return {
    state,
    error,
    run,
    selected: state.tabs.find((tab) => tab.id === state.selected),
  };
}
