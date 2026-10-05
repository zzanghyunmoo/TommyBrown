import { Cross2Icon, PlusIcon } from "@radix-ui/react-icons";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ModelSnapshot } from "../../../shared/bridge";
import { emptyMappings, launchModels } from "../../../shared/model-mappings";
import { providerSchema } from "../../../shared/proxy";
import { terminalLaunchSchema } from "../../../shared/terminal";
import type { Space } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";
import { RoutePreview } from "../models/route-preview";
import type { PaneHandle } from "./pane-handle";
import { TerminalConnectors } from "./terminal-connectors";
import { TerminalView } from "./terminal-view";
import type { useTerminals } from "./use-terminals";

export function TerminalPanel({
  space,
  terminals,
  openUrl,
  ref,
}: {
  readonly space: Space;
  readonly terminals: ReturnType<typeof useTerminals>;
  readonly openUrl: (url: string) => void;
  readonly ref?: Ref<PaneHandle>;
}) {
  const host = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string>();
  const [cli, setCli] = useState("powershell");
  const [model, setModel] = useState("");
  const [connectors, setConnectors] = useState<readonly string[]>([]);
  const [modelSnapshot, setModelSnapshot] = useState<ModelSnapshot>();
  const provider = providerSchema.safeParse(cli);
  const mappings = modelSnapshot?.mappings ?? emptyMappings();
  const choices = provider.success
    ? launchModels(
        mappings,
        provider.data,
        modelSnapshot?.models.filter(
          (candidate) => !candidate.id.startsWith("tb-"),
        ) ?? [],
      )
    : [];
  const [modelError, setModelError] = useState<string>();
  const sessions = terminals.sessions.filter(
    (session) => session.spaceId === space.id,
  );
  const current =
    sessions.find((session) => session.id === selected) ?? sessions[0];
  useEffect(() => {
    if (sessions.some((session) => session.id === terminals.selected))
      setSelected(terminals.selected);
  }, [sessions, terminals.selected]);
  function focus() {
    host.current
      ?.querySelector<HTMLTextAreaElement>(
        ".terminal-slot:not([hidden]) textarea",
      )
      ?.focus();
  }
  async function launch() {
    const session = await terminals.launch(
      terminalLaunchSchema.parse({
        spaceId: space.id,
        cli,
        model: cli === "powershell" || !model ? null : model,
        mappingRevision: modelSnapshot?.mappingRevision,
        connectors:
          cli === "powershell" || cli === "antigravity" ? [] : connectors,
      }),
    );
    if (session) {
      setSelected(session.id);
      requestAnimationFrame(focus);
    }
  }
  function selectTab(index: number) {
    const session = sessions[index];
    if (session) {
      setSelected(session.id);
      terminals.setSelected(session.id);
      requestAnimationFrame(focus);
    }
  }
  useImperativeHandle(ref, () => ({
    focus,
    newTab: () => {
      void launch();
    },
    closeTab: () => {
      if (current) void terminals.close(current.id);
    },
    selectTab,
    cycleTab: (offset) => {
      if (sessions.length)
        selectTab(
          (sessions.findIndex((session) => session.id === current?.id) +
            offset +
            sessions.length) %
            sessions.length,
        );
    },
  }));
  useEffect(() => {
    let active = true;
    window.desktop
      .snapshot()
      .then((snapshot) => {
        if (active) setModelSnapshot(snapshot);
      })
      .catch(() => {
        if (active) setModelSnapshot(undefined);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section ref={host} className="terminal-panel" aria-label="에이전트 터미널">
      <div className="terminal-launch">
        <label>
          CLI
          <select
            aria-label="CLI"
            value={cli}
            onChange={(event) => {
              setCli(event.target.value);
              setModel("");
            }}
          >
            <option value="powershell">PowerShell</option>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="antigravity">Antigravity</option>
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
                  setModelSnapshot(snapshot);
                  setModelError(undefined);
                })
                .catch((failure: unknown) => {
                  if (failure instanceof Error) setModelError(failure.message);
                });
            }}
          >
            <option value="">CLI 기존 설정</option>
            {model && !choices.includes(model) && (
              <option value={model}>{model} (설정 확인 필요)</option>
            )}
            {choices.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
        <Button
          busy={terminals.busy}
          onClick={() => {
            void launch();
          }}
          aria-label="새 세션"
        >
          <PlusIcon />
        </Button>
      </div>
      {provider.success && (
        <RoutePreview settings={mappings} cli={provider.data} model={model} />
      )}
      {terminals.error && <Notice error>{terminals.error}</Notice>}
      {modelError && <Notice error>{modelError}</Notice>}
      {cli === "antigravity" ? (
        <p className="cli-note">Antigravity의 MCP 연결은 CLI에서 관리합니다.</p>
      ) : (
        <TerminalConnectors
          selected={connectors}
          change={setConnectors}
          disabled={cli === "powershell"}
        />
      )}
      <div className="terminal-tabs" role="tablist" aria-label="터미널 탭">
        {sessions.map((session, index) => (
          <div className="terminal-tab" key={session.id}>
            <button
              type="button"
              role="tab"
              aria-selected={session.id === current?.id}
              onClick={() => selectTab(index)}
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
