import { useCallback, useEffect, useState } from "react";
import type { Space, WorkspaceState } from "../../../shared/workspace";

export function useSpaces() {
  const [state, setState] = useState<WorkspaceState>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    window.workspace
      .snapshot()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((failure: unknown) => {
        if (active && failure instanceof Error) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const run = useCallback(async (action: () => Promise<WorkspaceState>) => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await action();
      setState(next);
      return next;
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return {
    state,
    error,
    busy,
    selected: state?.spaces.find((space) => space.id === state.selectedSpace),
    choose: (kind: Space["kind"]) =>
      run(() => window.workspace.chooseSpace(kind)),
    select: (id: string) => run(() => window.workspace.selectSpace(id)),
    remove: (id: string) => run(() => window.workspace.removeSpace(id)),
  };
}
