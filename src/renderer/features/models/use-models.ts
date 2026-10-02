import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelSnapshot } from "../../../shared/bridge";
import type { Provider } from "../../../shared/proxy";

export function useModels() {
  const [snapshot, setSnapshot] = useState<ModelSnapshot>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  const refresh = useCallback(
    async () => setSnapshot(await window.desktop.snapshot()),
    [],
  );
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await window.desktop.snapshot();
        if (alive) setSnapshot(next);
      } catch (failure) {
        if (alive && failure instanceof Error) setError(failure.message);
      } finally {
        if (alive)
          timer = setTimeout(() => {
            void poll();
          }, 3000);
      }
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  const run = useCallback(
    async (name: string, action?: () => Promise<void>) => {
      if (locked.current) return;
      locked.current = true;
      setBusy(name);
      setError(undefined);
      try {
        await action?.();
        await refresh();
      } catch (failure) {
        if (failure instanceof Error) setError(failure.message);
      } finally {
        locked.current = false;
        setBusy(undefined);
      }
    },
    [refresh],
  );
  const pending = snapshot?.login ?? undefined;
  const login = (provider: Provider) =>
    run("login", async () => {
      await window.desktop.login(provider);
    });
  const cancel = () =>
    run("cancel", async () => {
      if (!pending) return;
      await window.desktop.cancelLogin(pending.state);
    });
  const stop = () => run("stop", () => window.desktop.stop());
  return {
    snapshot,
    busy,
    error: error ?? snapshot?.loginError ?? undefined,
    pending,
    run,
    login,
    cancel,
    stop,
  };
}
