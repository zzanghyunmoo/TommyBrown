import { CodeIcon, FileTextIcon, Link2Icon } from "@radix-ui/react-icons";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Space } from "../../../shared/workspace";
import { Notice } from "../../components/primitives";
import { ConnectorPane } from "./connector-pane";
import { DocumentPane } from "./document-pane";
import { ModeTabs } from "./mode-tabs";
import type { PaneHandle } from "./pane-handle";
import { TerminalPanel } from "./terminal-panel";
import type { useTerminals } from "./use-terminals";
import { readViewState, saveViewState } from "./view-state";

export function MainPane({
  space,
  terminals,
  openUrl,
  openApp,
  actions,
  ref,
}: {
  readonly space: Space;
  readonly terminals: ReturnType<typeof useTerminals>;
  readonly openUrl: (url: string) => void;
  readonly openApp: (id: string) => Promise<void>;
  readonly actions: ReactNode;
  readonly ref?: Ref<PaneHandle>;
}) {
  const [mode, setMode] = useState(() =>
    space.kind === "vault" ? ("documents" as const) : readViewState().workMode,
  );
  const [error, setError] = useState<string>();
  const terminal = useRef<PaneHandle>(null);
  const documents = useRef<PaneHandle>(null);
  const connectors = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (space.kind === "vault") setMode("documents");
  }, [space.kind]);
  const selectedHere = terminals.sessions.some(
    (session) =>
      session.id === terminals.selection?.id && session.spaceId === space.id,
  );
  useEffect(() => {
    if (terminals.selection && selectedHere) setMode("terminal");
  }, [terminals.selection, selectedHere]);
  useEffect(() => {
    try {
      saveViewState({ workMode: mode });
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    }
  }, [mode]);
  function current() {
    return mode === "terminal"
      ? terminal.current
      : mode === "documents"
        ? documents.current
        : null;
  }
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (mode === "connectors")
        connectors.current
          ?.querySelector<HTMLElement>("input, button")
          ?.focus();
      else current()?.focus();
    },
    newTab: () => current()?.newTab(),
    closeTab: () => current()?.closeTab(),
    cycleTab: (offset) => current()?.cycleTab(offset),
    selectTab: (index) => current()?.selectTab(index),
  }));
  return (
    <div className="main-pane">
      <ModeTabs
        label="작업 탭"
        selected={mode}
        select={setMode}
        items={[
          {
            id: "terminal",
            label: "터미널",
            panel: "work-terminal",
            icon: <CodeIcon />,
          },
          {
            id: "documents",
            label: "코드·문서",
            panel: "work-documents",
            icon: <FileTextIcon />,
          },
          {
            id: "connectors",
            label: "커넥터",
            panel: "work-connectors",
            icon: <Link2Icon />,
          },
        ]}
      >
        {actions}
      </ModeTabs>
      {error && <Notice error>{error}</Notice>}
      <div
        className="main-pane-page"
        id="work-terminal"
        role="tabpanel"
        aria-label="터미널"
        hidden={mode !== "terminal"}
      >
        <TerminalPanel
          ref={terminal}
          space={space}
          terminals={terminals}
          openUrl={openUrl}
        />
      </div>
      <div
        className="main-pane-page"
        id="work-documents"
        role="tabpanel"
        aria-label="코드·문서"
        hidden={mode !== "documents"}
      >
        <DocumentPane ref={documents} space={space} openUrl={openUrl} />
      </div>
      <div
        ref={connectors}
        id="work-connectors"
        role="tabpanel"
        aria-label="커넥터"
        className="main-pane-page"
        hidden={mode !== "connectors"}
      >
        <ConnectorPane openWeb={openApp} />
      </div>
    </div>
  );
}
