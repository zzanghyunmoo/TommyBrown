import {
  MixerHorizontalIcon,
  MoonIcon,
  Share2Icon,
} from "@radix-ui/react-icons";
import { useState } from "react";
import { Notice, Panel } from "../../components/primitives";
import { ThemeChoice } from "../../components/theme-choice";
import { ModelAccess } from "../models/model-access";
import { ConnectorPane } from "../workspace/connector-pane";
import { ModeTabs } from "../workspace/mode-tabs";
import { readViewState, saveViewState } from "../workspace/view-state";

const sections = [
  {
    id: "proxy",
    label: "프록시·모델",
    panel: "settings-proxy",
    icon: <MixerHorizontalIcon />,
  },
  {
    id: "general",
    label: "일반·색상",
    panel: "settings-general",
    icon: <MoonIcon />,
  },
  {
    id: "mcp",
    label: "MCP 게이트웨이",
    panel: "settings-mcp",
    icon: <Share2Icon />,
  },
] as const;

export function SettingsPage({
  sidebarHidden,
  setSidebarHidden,
}: {
  readonly sidebarHidden: boolean;
  readonly setSidebarHidden: (hidden: boolean) => void;
}) {
  const [section, setSection] = useState(() => readViewState().settingsSection);
  const [mcpOpened, setMcpOpened] = useState(() => section === "mcp");
  const [error, setError] = useState<string>();
  const [appearanceError, setAppearanceError] = useState<string>();
  return (
    <section className="settings-layout" aria-label="설정">
      <ModeTabs
        label="설정 분류"
        items={sections}
        selected={section}
        select={(next) => {
          setSection(next);
          if (next === "mcp") setMcpOpened(true);
          try {
            saveViewState({ settingsSection: next });
            setError(undefined);
          } catch {
            setError("마지막 설정 화면을 저장하지 못했습니다.");
          }
        }}
      />
      {error && <Notice error>{error}</Notice>}
      <div
        className="settings-panel"
        id="settings-proxy"
        role="tabpanel"
        aria-label="프록시·모델"
        hidden={section !== "proxy"}
      >
        <ModelAccess />
      </div>
      <div
        className="settings-panel"
        id="settings-general"
        role="tabpanel"
        aria-label="일반·색상"
        hidden={section !== "general"}
      >
        <div className="general-settings">
          <header className="page-heading">
            <div>
              <span className="eyebrow">설정</span>
              <h1>일반·색상</h1>
              <p>화면과 터미널의 색상, 탐색 메뉴 표시를 설정합니다.</p>
            </div>
          </header>
          {appearanceError && <Notice error>{appearanceError}</Notice>}
          <Panel
            title="색상 테마"
            description="앱, 터미널, 코드 편집기에 함께 적용하며 다음 실행에도 유지합니다."
          >
            <div className="settings-row">
              <span>화면 색상</span>
              <ThemeChoice label="일반 설정 테마" report={setAppearanceError} />
            </div>
          </Panel>
          <Panel
            title="탐색 메뉴"
            description="사이드바를 숨겨도 상단에서 설정과 작업 공간을 열 수 있습니다."
          >
            <label className="settings-row">
              <span>사이드바 표시</span>
              <input
                type="checkbox"
                checked={!sidebarHidden}
                onChange={(event) => setSidebarHidden(!event.target.checked)}
              />
            </label>
          </Panel>
        </div>
      </div>
      <div
        className="settings-panel"
        id="settings-mcp"
        role="tabpanel"
        aria-label="MCP 게이트웨이"
        hidden={section !== "mcp"}
      >
        {mcpOpened && <ConnectorPane settings />}
      </div>
    </section>
  );
}
