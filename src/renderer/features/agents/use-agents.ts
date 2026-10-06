import { useEffect, useState } from "react";
import type { AgentStatus } from "../../../shared/agents";

export function useAgents() {
  const [states, setStates] = useState<readonly AgentStatus[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll(initial = false) {
      try {
        const result = await (initial
          ? window.agents.refresh()
          : window.agents.snapshot());
        if (active) {
          setStates(result);
          setError(undefined);
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "CLI 상태를 읽지 못했습니다.",
          );
      } finally {
        if (active)
          timer = setTimeout(() => {
            void poll();
          }, 1000);
      }
    }
    void poll(true);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  async function act(action: () => Promise<readonly AgentStatus[]>) {
    try {
      setStates(await action());
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "CLI 작업 실패");
    }
  }
  return { states, error, act };
}
