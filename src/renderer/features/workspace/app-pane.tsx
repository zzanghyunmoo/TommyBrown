import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Space } from "../../../shared/workspace";
import { Notice } from "../../components/primitives";
import { BrowserPane } from "./browser-pane";
import { ConnectorPane } from "./connector-pane";
import { DocumentPane } from "./document-pane";
import type { PaneHandle } from "./pane-handle";
import { useBrowser } from "./use-browser";
import { readViewState, saveViewState } from "./view-state";

export function AppPane({
  space,
  openUrl,
  visible,
  boundsKey,
  ref,
}: {
  readonly space: Space;
  readonly openUrl: (url: string) => void;
  readonly visible: boolean;
  readonly boundsKey: string;
  readonly ref?: Ref<PaneHandle>;
}) {
  const application = useBrowser("app");
  const [mode, setMode] = useState(() =>
    space.kind === "vault" ? "documents" : readViewState().appMode,
  );
  useEffect(() => {
    if (space.kind === "vault") setMode("documents");
  }, [space.kind]);
  const [error, setError] = useState<string>();
  const browser = useRef<PaneHandle>(null);
  const documents = useRef<PaneHandle>(null);
  const connectors = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      saveViewState({ appMode: mode });
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    }
  }, [mode]);
  function current() {
    return mode === "app"
      ? browser.current
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
    <div className="right-workspace">
      <nav className="right-pane-tabs" aria-label="앱과 작업 도구">
        <button
          type="button"
          aria-pressed={mode === "app"}
          onClick={() => setMode("app")}
        >
          앱 화면
        </button>
        <button
          type="button"
          aria-pressed={mode === "documents"}
          onClick={() => setMode("documents")}
        >
          코드·문서
        </button>
        <button
          type="button"
          aria-pressed={mode === "connectors"}
          onClick={() => setMode("connectors")}
        >
          커넥터
        </button>
      </nav>
      {error && <Notice error>{error}</Notice>}
      <div className="right-pane-page" hidden={mode !== "app"}>
        <BrowserPane
          ref={browser}
          browser={application}
          app
          visible={visible && mode === "app"}
          boundsKey={boundsKey}
        />
      </div>
      <div className="right-pane-page" hidden={mode !== "documents"}>
        <DocumentPane ref={documents} space={space} openUrl={openUrl} />
      </div>
      <div
        ref={connectors}
        className="right-pane-page"
        hidden={mode !== "connectors"}
      >
        <ConnectorPane
          openWeb={async (id) => {
            await application.run(() => window.connectors.open(id, "app"));
            setMode("app");
          }}
        />
      </div>
    </div>
  );
}
