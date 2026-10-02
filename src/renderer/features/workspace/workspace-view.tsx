import { useEffect, useState } from "react";
import type { Space } from "../../../shared/workspace";
import { Notice } from "../../components/primitives";
import { BrowserPane } from "./browser-pane";
import { ConnectorPane } from "./connector-pane";
import { DocumentPane } from "./document-pane";
import { TerminalPanel } from "./terminal-panel";
import { useBrowser } from "./use-browser";
import type { useTerminals } from "./use-terminals";
import { readViewState, saveViewState } from "./view-state";

export function WorkspaceView({
  space,
  terminals,
}: {
  readonly space: Space;
  readonly terminals: ReturnType<typeof useTerminals>;
}) {
  const browser = useBrowser();
  const [pane, setPane] = useState<"documents" | "browser" | "connectors">(
    () => readViewState().pane,
  );
  const [settingsError, setSettingsError] = useState<string>();
  useEffect(() => {
    try {
      saveViewState({ pane });
    } catch {
      setSettingsError("패널 설정을 저장하지 못했습니다.");
    }
  }, [pane]);
  function openUrl(url: string) {
    setPane("browser");
    void browser.run(() => window.browser.open(url));
  }
  return (
    <div className="ade-layout">
      <TerminalPanel space={space} terminals={terminals} openUrl={openUrl} />
      <div className="right-workspace">
        {settingsError && <Notice error>{settingsError}</Notice>}
        <div className="right-pane-tabs">
          <button
            type="button"
            aria-pressed={pane === "connectors"}
            onClick={() => setPane("connectors")}
          >
            커넥터
          </button>
          <button
            type="button"
            aria-pressed={pane === "documents"}
            onClick={() => setPane("documents")}
          >
            코드·문서
          </button>
          <button
            type="button"
            aria-pressed={pane === "browser"}
            onClick={() => setPane("browser")}
          >
            브라우저{" "}
            {browser.state.tabs.length > 0 ? browser.state.tabs.length : ""}
          </button>
        </div>
        <div className="right-pane-page" hidden={pane !== "documents"}>
          <DocumentPane space={space} openUrl={openUrl} />
        </div>
        <div className="right-pane-page" hidden={pane !== "browser"}>
          <BrowserPane browser={browser} visible={pane === "browser"} />
        </div>
        <div className="right-pane-page" hidden={pane !== "connectors"}>
          <ConnectorPane
            openWeb={async (id) => {
              await window.connectors.open(id);
              await browser.run(() => window.browser.snapshot());
              setPane("browser");
            }}
          />
        </div>
      </div>
    </div>
  );
}
