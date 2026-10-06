import { type AgentStatus, agentNames } from "../../../shared/agents";
import { Button, Notice, Panel, Status } from "../../components/primitives";
import { useAgents } from "./use-agents";

export function AgentInstallation({
  state,
  busy,
  act,
  compact = false,
}: {
  readonly state: AgentStatus;
  readonly busy: boolean;
  readonly act: ReturnType<typeof useAgents>["act"];
  readonly compact?: boolean;
}) {
  const installing = state.phase === "installing";
  const failed = state.phase === "failed";
  const ready = state.phase === "installed";
  const name = agentNames[state.id];
  return (
    <section
      className={`agent-installation ${compact ? "compact" : ""}`}
      aria-label={`${name} 설치`}
    >
      <div className="agent-installation-heading">
        <div>
          <strong>{name}</strong>
          <Status tone={ready ? "success" : failed ? "error" : "pending"}>
            {ready
              ? "설치됨"
              : installing
                ? "설치 중"
                : state.phase === "checking"
                  ? "확인 중"
                  : failed
                    ? "확인 필요"
                    : state.phase === "unsupported"
                      ? "지원하지 않음"
                      : "미설치"}
          </Status>
        </div>
        {installing ? (
          <Button
            onClick={() => {
              void act(() => window.agents.cancel(state.id));
            }}
          >
            설치 취소
          </Button>
        ) : !ready && state.phase !== "unsupported" ? (
          <Button
            tone="primary"
            disabled={busy || state.phase === "checking"}
            onClick={() => {
              void act(() => window.agents.install(state.id));
            }}
          >
            {failed ? "다시 시도" : `${name} 설치`}
          </Button>
        ) : null}
      </div>
      <p role={failed ? "alert" : "status"}>
        {ready ? (state.version ?? state.message) : state.message}
      </p>
      {state.path && !compact && (
        <code className="agent-path">{state.path}</code>
      )}
      {!ready && compact && (
        <p>
          공식 설치 프로그램을 현재 사용자 계정으로 실행합니다. PATH·셸 설정이
          갱신될 수 있습니다.
        </p>
      )}
      {state.log && (
        <details open={failed}>
          <summary>설치 로그</summary>
          <pre className="agent-installation-log">{state.log}</pre>
        </details>
      )}
    </section>
  );
}

export function AgentSettings() {
  const agents = useAgents();
  const busy = agents.states.some(
    (state) => state.phase === "installing" || state.phase === "checking",
  );
  return (
    <Panel
      title="코딩 에이전트"
      description="공식 CLI를 현재 사용자 계정에 설치합니다. 설치 프로그램이 PATH·셸 설정을 갱신할 수 있습니다. 설치 후 새 터미널 세션에서 사용하세요."
      action={
        <Button
          disabled={busy}
          onClick={() => {
            void agents.act(() => window.agents.refresh());
          }}
        >
          설치 다시 확인
        </Button>
      }
    >
      {agents.error && <Notice error>{agents.error}</Notice>}
      {!agents.states.length && (
        <Notice>설치된 CLI를 확인하고 있습니다…</Notice>
      )}
      {agents.states.map((state) => (
        <AgentInstallation
          key={state.id}
          state={state}
          busy={busy}
          act={agents.act}
        />
      ))}
    </Panel>
  );
}
