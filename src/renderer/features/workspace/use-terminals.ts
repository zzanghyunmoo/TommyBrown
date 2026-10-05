import { useCallback, useEffect, useState } from "react";
import type { TerminalInfo, TerminalLaunch } from "../../../shared/terminal";

export function useTerminals() {
  const [sessions, setSessions] = useState<readonly TerminalInfo[]>([]);
  const [selection, setSelection] = useState<{ readonly id: string }>();
  const selected = selection?.id;
  const setSelected = useCallback((id: string) => setSelection({ id }), []);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async () => setSessions(await window.terminal.list()),
    [],
  );
  useEffect(() => {
    void refresh().catch((failure: unknown) => {
      if (failure instanceof Error) setError(failure.message);
    });
    return window.terminal.onEvent((event) => {
      if (event.type === "closed")
        setSessions((previous) =>
          previous.filter((session) => session.id !== event.id),
        );
      if (event.type === "exit")
        setSessions((previous) =>
          previous.map((session) =>
            session.id === event.id
              ? { ...session, phase: "exited", exitCode: event.exitCode }
              : session,
          ),
        );
    });
  }, [refresh]);
  async function launch(request: TerminalLaunch) {
    setError(undefined);
    setBusy(true);
    try {
      const session = await window.terminal.launch(request);
      setSelected(session.id);
      await refresh();
      return session;
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function close(id: string) {
    setError(undefined);
    try {
      await window.terminal.close(id);
      await refresh();
      return true;
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
      return false;
    }
  }
  return {
    sessions,
    selected,
    selection,
    setSelected,
    error,
    busy,
    launch,
    close,
  };
}
