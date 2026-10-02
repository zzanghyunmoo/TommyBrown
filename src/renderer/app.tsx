import { CubeIcon, GearIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { ModelAccess } from "./features/models/model-access";

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="TommyBrown 탐색">
        <div className="brand">
          <span className="monogram">TB</span>
          <strong>TommyBrown</strong>
        </div>
        <div className="sidebar-content">
          <div className="nav-group">
            <span className="eyebrow">WORKSPACE</span>
            <div className="sidebar-empty">
              <CubeIcon />
              <p>아직 열린 공간이 없습니다</p>
            </div>
          </div>
          <div className="nav-group">
            <span className="eyebrow">SETTINGS</span>
            <div className="nav-row selected" aria-current="page">
              <GearIcon />
              모델 연결
            </div>
          </div>
        </div>
        <div className="sidebar-footer">
          <LockClosedIcon />
          로컬 워크스페이스
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <span>설정</span>
          <span className="header-separator">/</span>
          <strong>모델 연결</strong>
          <span className="local-label">TommyBrown · desktop</span>
        </header>
        <div className="workspace-tabs">
          <span className="workspace-tab">
            <GearIcon />
            모델 연결
          </span>
        </div>
        <div className="workspace-content">
          <ModelAccess />
        </div>
        <footer className="statusbar">
          <span>TommyBrown 0.1.0</span>
          <span>계정 연결 및 모델 공유</span>
        </footer>
      </div>
    </div>
  );
}
