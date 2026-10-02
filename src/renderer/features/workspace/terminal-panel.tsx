import { Cross2Icon, PlusIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import type { ProxyModel } from "../../../shared/proxy";
import { terminalLaunchSchema } from "../../../shared/terminal";
import type { Space } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";
import { TerminalConnectors } from "./terminal-connectors";
import { TerminalView } from "./terminal-view";
import type { useTerminals } from "./use-terminals";

export function TerminalPanel({
  space,
  terminals,
  openUrl,
}: {
  readonly space: Space;
  readonly terminals: ReturnType<typeof useTerminals>;
  readonly openUrl: (url: string) => void;
}) {
  const [cli, setCli] = useState("powershell");
  const [model, setModel] = useState("");
  const [connectors, setConnectors] = useState<readonly string[]>([]);
  const [models, setModels] = useState<readonly ProxyModel[]>([]);
  const [modelError, setModelError] = useState<string>();
  const sessions = terminals.sessions.filter(
    (session) => session.spaceId === space.id,
  );
  const current =
    sessions.find((session) => session.id === terminals.selected) ??
    sessions[0];
  useEffect(() => {
    let active = true;
    window.desktop
      .snapshot()
      .then((snapshot) => {
        if (active) setModels(snapshot.models);
      })
      .catch(() => {
        if (active) setModels([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="terminal-panel" aria-label="에이전트 터미널">
      <div className="terminal-launch">
        <label>
          CLI
          <select
            aria-label="CLI"
            value={cli}
            onChange={(event) => setCli(event.target.value)}
          >
            <option value="powershell">PowerShell</option>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>
        <label>
          모델
          <select
            aria-label="모델"
            value={model}
            disabled={cli === "powershell"}
            onChange={(event) => setModel(event.target.value)}
            onFocus={() => {
              void window.desktop
                .snapshot()
                .then((snapshot) => {
                  setModels(snapshot.models);
                  setModelError(undefined);
                })
                .catch((failure: unknown) => {
                  if (failure instanceof Error) setModelError(failure.message);
                });
            }}
          >
            <option value="">CLI 기존 설정</option>
            {models.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id}
              </option>
            ))}
          </select>
        </label>
        <Button
          busy={terminals.busy}
          onClick={() => {
            void terminals.launch(
              terminalLaunchSchema.parse({
                spaceId: space.id,
                cli,
                model: cli === "powershell" || !model ? null : model,
                connectors: cli === "powershell" ? [] : connectors,
              }),
            );
          }}
          aria-label="새 세션"
        >
          <PlusIcon />
        </Button>
      </div>
      {terminals.error && <Notice error>{terminals.error}</Notice>}
      {modelError && <Notice error>{modelError}</Notice>}
      <TerminalConnectors
        selected={connectors}
        change={setConnectors}
        disabled={cli === "powershell"}
      />
      <div className="terminal-tabs" role="tablist" aria-label="터미널 탭">
        {sessions.map((session, index) => (
          <div className="terminal-tab" key={session.id}>
            <button
              type="button"
              role="tab"
              aria-selected={session.id === current?.id}
              onClick={() => terminals.setSelected(session.id)}
            >
              {session.cli} {index + 1}
              {session.phase === "exited" ? ` · 종료 ${session.exitCode}` : ""}
            </button>
            <button
              type="button"
              aria-label={`${session.cli} ${index + 1} 종료`}
              onClick={() => {
                void terminals.close(session.id);
              }}
            >
              <Cross2Icon />
            </button>
          </div>
        ))}
      </div>
      {sessions.map((session) => (
        <div
          key={session.id}
          className="terminal-slot"
          hidden={session.id !== current?.id}
        >
          <TerminalView session={session} openUrl={openUrl} />
        </div>
      ))}
      {!sessions.length && (
        <div className="terminal-empty">
          <h2>이 공간에서 작업 시작</h2>
          <p>PowerShell 또는 코딩 CLI를 선택하고 새 세션을 여세요.</p>
          <p>연결된 모델을 선택하면 해당 세션에만 모델 라우팅이 적용됩니다.</p>
        </div>
      )}
    </section>
  );
}
