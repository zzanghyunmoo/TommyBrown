import {
  CubeIcon,
  GearIcon,
  HamburgerMenuIcon,
  LockClosedIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { lazy, Suspense, useEffect, useState } from "react";
import { Button, Notice } from "./components/primitives";
import { ThemeChoice } from "./components/theme-choice";
import { ModelAccess } from "./features/models/model-access";
import { useSpaces } from "./features/workspace/use-spaces";
import { useTerminals } from "./features/workspace/use-terminals";
import { readViewState, saveViewState } from "./features/workspace/view-state";

const WorkspaceView = lazy(() =>
  import("./features/workspace/workspace-view").then((module) => ({
    default: module.WorkspaceView,
  })),
);

export function App() {
  const spaces = useSpaces();
  const terminals = useTerminals();
  const [sidebarHidden, setSidebarHidden] = useState(
    () => readViewState().sidebarHidden,
  );
  const [page, setPage] = useState<"models" | "workspace" | null>(
    () => readViewState().page,
  );
  const [settingsError, setSettingsError] = useState<string>();
  const [appearanceError, setAppearanceError] = useState<string>();
  useEffect(() => {
    try {
      saveViewState({ sidebarHidden });
    } catch (failure) {
      if (failure instanceof Error) setSettingsError(failure.message);
    }
  }, [sidebarHidden]);
  useEffect(() => {
    try {
      saveViewState({ page });
    } catch {
      setSettingsError("화면 설정을 저장하지 못했습니다.");
    }
  }, [page]);
  const screen = !spaces.selected ? "models" : (page ?? "workspace");
  async function choose(kind: "workspace" | "vault") {
    const state = await spaces.choose(kind);
    if (state?.selectedSpace) setPage("workspace");
  }
  return (
    <div className={`app-shell ${sidebarHidden ? "sidebar-hidden" : ""}`}>
      <aside
        className="sidebar"
        aria-label="TommyBrown 탐색"
        hidden={sidebarHidden}
      >
        <div className="brand">
          <span className="monogram">TB</span>
          <strong>TommyBrown</strong>
        </div>
        <div className="sidebar-content">
          <div className="nav-group">
            <span className="eyebrow">WORKSPACE</span>
            {!spaces.state?.spaces.length && (
              <div className="sidebar-empty">
                <CubeIcon />
                <p>아직 열린 공간이 없습니다</p>
              </div>
            )}
            {spaces.state?.spaces.map((space) => (
              <button
                type="button"
                key={space.id}
                className={`nav-row space-row ${screen === "workspace" && spaces.selected?.id === space.id ? "selected" : ""}`}
                onClick={() => {
                  void spaces.select(space.id);
                  setPage("workspace");
                }}
                title={space.root}
                aria-current={
                  screen === "workspace" && spaces.selected?.id === space.id
                    ? "page"
                    : undefined
                }
              >
                <CubeIcon />
                <span>{space.name}</span>
                {space.kind === "vault" && <small>vault</small>}
              </button>
            ))}
            <Button
              tone="quiet"
              disabled={spaces.busy}
              onClick={() => {
                void choose("workspace");
              }}
            >
              <PlusIcon />
              공간 열기
            </Button>
            <Button
              tone="quiet"
              disabled={spaces.busy}
              onClick={() => {
                void choose("vault");
              }}
            >
              <PlusIcon />
              Obsidian 보관함
            </Button>
          </div>
          {spaces.selected && (
            <div className="nav-group">
              <span className="eyebrow">AGENTS</span>
              {terminals.sessions
                .filter((session) => session.spaceId === spaces.selected?.id)
                .map((session, index) => (
                  <button
                    type="button"
                    key={session.id}
                    className={`nav-row space-row ${terminals.selected === session.id ? "selected" : ""}`}
                    onClick={() => {
                      terminals.setSelected(session.id);
                      setPage("workspace");
                    }}
                  >
                    <span className={`agent-dot ${session.phase}`} />
                    <span>
                      {session.cli} {index + 1}
                    </span>
                    <small>
                      {session.phase === "running" ? "실행 중" : "종료"}
                    </small>
                  </button>
                ))}
            </div>
          )}
          <div className="nav-group">
            <span className="eyebrow">SETTINGS</span>
            <button
              type="button"
              className={`nav-row space-row ${screen === "models" ? "selected" : ""}`}
              aria-current={screen === "models" ? "page" : undefined}
              onClick={() => setPage("models")}
            >
              <GearIcon />
              모델 연결
            </button>
          </div>
        </div>
        <div className="sidebar-footer">
          <LockClosedIcon />
          로컬 워크스페이스
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <Button
            tone="quiet"
            aria-label="사이드바 표시 전환"
            aria-pressed={!sidebarHidden}
            onClick={() => setSidebarHidden((hidden) => !hidden)}
          >
            <HamburgerMenuIcon />
          </Button>
          <nav className="workspace-tabs" aria-label="열린 화면">
            <button
              type="button"
              className="workspace-tab"
              aria-current={screen === "models" ? "page" : undefined}
              onClick={() => setPage("models")}
            >
              <GearIcon />
              <span>모델 연결</span>
            </button>
            {spaces.selected && (
              <button
                type="button"
                className="workspace-tab"
                aria-current={screen === "workspace" ? "page" : undefined}
                title={spaces.selected.name}
                onClick={() => setPage("workspace")}
              >
                <CubeIcon />
                <span>{spaces.selected.name}</span>
              </button>
            )}
          </nav>
          <ThemeChoice report={setAppearanceError} />
        </header>
        <div className="workspace-content">
          {spaces.error && <Notice error>{spaces.error}</Notice>}
          {settingsError && <Notice error>{settingsError}</Notice>}
          {appearanceError && <Notice error>{appearanceError}</Notice>}
          <div className="workspace-page" hidden={screen !== "models"}>
            <ModelAccess />
          </div>
          {spaces.selected && (
            <div className="workspace-page" hidden={screen !== "workspace"}>
              <Suspense
                fallback={
                  <p className="pane-empty" role="status">
                    편집기를 여는 중…
                  </p>
                }
              >
                <WorkspaceView
                  space={spaces.selected}
                  spaces={spaces.state?.spaces ?? []}
                  terminals={terminals}
                  visible={screen === "workspace"}
                  toggleSidebar={() => setSidebarHidden((hidden) => !hidden)}
                  openSpace={() => {
                    void choose("workspace");
                  }}
                  selectSpace={(id) => {
                    void spaces.select(id);
                    setPage("workspace");
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>
        <footer className="statusbar">
          <span>TommyBrown 0.1.0</span>
          <span>
            {
              terminals.sessions.filter(
                (session) => session.phase === "running",
              ).length
            }
            개 세션 실행 중
          </span>
        </footer>
      </div>
    </div>
  );
}
