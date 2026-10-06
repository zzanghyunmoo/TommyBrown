import { useEffect, useSyncExternalStore } from "react";
import type { Connector } from "../../../shared/connectors";

let connectors: readonly Connector[] = [];
let revision = 0;
const listeners = new Set<() => void>();
const snapshot = () => connectors;
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function publishConnectors(next: readonly Connector[]) {
  revision += 1;
  connectors = next;
  for (const listener of listeners) listener();
}

export function useConnectorRegistry(report: (error: string) => void) {
  const current = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    let active = true;
    const startedAt = revision;
    void window.connectors.list().then(
      (list) => {
        if (active && startedAt === revision) publishConnectors(list);
      },
      (failure: unknown) => {
        if (active)
          report(
            failure instanceof Error
              ? failure.message
              : "커넥터를 불러오지 못했습니다.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [report]);
  return current;
}
