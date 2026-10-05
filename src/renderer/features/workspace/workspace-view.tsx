import {
  CodeIcon,
  ColumnsIcon,
  Cross2Icon,
  CubeIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  GlobeIcon,
  QuestionMarkCircledIcon,
  RowsIcon,
} from "@radix-ui/react-icons";
import type { Space } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";
import { BrowserPane } from "./browser-pane";
import type { PaneRectangle } from "./layout";
import { MainPane } from "./main-pane";
import { ModeTabs } from "./mode-tabs";
import { Splitter } from "./splitter";
import { TerminalPanel } from "./terminal-panel";
import { useBrowser } from "./use-browser";
import type { useTerminals } from "./use-terminals";
import { useWorkbench } from "./use-workbench";
import { WorkbenchDialog } from "./workbench-dialog";

export function WorkspaceView({
  space,
  spaces,
  terminals,
  visible,
  toggleSidebar,
  openSpace,
  selectSpace,
}: {
  readonly space: Space;
  readonly spaces: readonly Space[];
  readonly terminals: ReturnType<typeof useTerminals>;
  readonly visible: boolean;
  readonly toggleSidebar: () => void;
  readonly openSpace: () => void;
  readonly selectSpace: (id: string) => void;
}) {
  const browser = useBrowser("browser");
  const application = useBrowser("app");
  const workbench = useWorkbench({
    space,
    terminals,
    visible,
    toggleSidebar,
    openSpace,
  });
  function openUrl(url: string) {
    if (workbench.ensure("browser")) void browser.open(url);
  }
  const rendered: readonly PaneRectangle[] = [
    ...workbench.panes,
    ...(["browser", "app"] as const)
      .filter((kind) => !workbench.panes.some((pane) => pane.kind === kind))
      .map((kind) => ({ kind, id: kind, x: 0, y: 0, width: 0, height: 0 })),
  ];
  const nativeVisible = visible && !workbench.dialog && !workbench.dragging;
  function paneActions(id: string, title: string) {
    return (
      <>
        <Button
          tone="quiet"
          aria-label={title + (workbench.zoom === id ? " 복원" : " 확대")}
          title="Ctrl+B → z"
          onClick={() => workbench.command("zoom", id)}
        >
          {workbench.zoom === id ? (
            <ExitFullScreenIcon />
          ) : (
            <EnterFullScreenIcon />
          )}
        </Button>
        <Button
          tone="quiet"
          aria-label={`${title} 패널 닫기`}
          title="Ctrl+B → x"
          onClick={() => {
            void workbench.closePane(id);
          }}
        >
          <Cross2Icon />
        </Button>
      </>
    );
  }
  return (
    <section className="workbench" aria-label="탭 작업 화면">
      <div className="workbench-toolbar">
        <div className="workbench-actions">
          <Button tone="quiet" onClick={() => workbench.ensure("browser")}>
            <GlobeIcon />
            브라우저
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              workbench.ensure("app");
            }}
          >
            <CubeIcon />앱
          </Button>
          <span className="toolbar-divider" />
          <Button
            tone="quiet"
            aria-label="오른쪽 분할"
            title="Ctrl+B → v"
            onClick={() => workbench.command("split-right")}
          >
            <ColumnsIcon />
          </Button>
          <Button
            tone="quiet"
            aria-label="아래 분할"
            title="Ctrl+B → -"
            onClick={() => workbench.command("split-down")}
          >
            <RowsIcon />
          </Button>
        </div>
        <span className="key-mode" role="status">
          {workbench.mode === "prefix"
            ? "다음 키를 누르세요 · Esc 취소"
            : workbench.mode === "resize"
              ? "크기 조절 · h/j/k/l · Esc 종료"
              : "Ctrl+B"}
        </span>
        <Button
          tone="quiet"
          aria-label="단축키 도움말"
          onClick={() => workbench.setDialog("help")}
        >
          <QuestionMarkCircledIcon />
        </Button>
      </div>
      {workbench.error && (
        <div className="workbench-error">
          <Notice error>{workbench.error}</Notice>
          <Button tone="quiet" onClick={() => workbench.setError(undefined)}>
            닫기
          </Button>
        </div>
      )}
      <div className="workbench-canvas" ref={workbench.canvas}>
        {rendered.map((pane) => {
          const shown =
            pane.width > 0 && (!workbench.zoom || workbench.zoom === pane.id);
          const title =
            pane.id === "terminal"
              ? "작업"
              : pane.kind === "terminal"
                ? "터미널"
                : pane.kind === "browser"
                  ? "브라우저"
                  : "앱 · 도구";
          return (
            <section
              key={pane.id}
              id={`pane-${pane.id}`}
              role={pane.kind === "terminal" ? "region" : "tabpanel"}
              className="workbench-pane"
              data-pane={pane.id}
              data-kind={pane.kind}
              data-focused={workbench.focused === pane.id}
              aria-label={`${title} 패널`}
              hidden={!shown}
              style={
                workbench.zoom === pane.id
                  ? { inset: 0 }
                  : {
                      left: `${pane.x}%`,
                      top: `${pane.y}%`,
                      width: `${pane.width}%`,
                      height: `${pane.height}%`,
                    }
              }
              onFocusCapture={() => workbench.setActive(pane.id)}
              onPointerDownCapture={() => workbench.setActive(pane.id)}
            >
              {pane.id !== "terminal" && (
                <header className="workbench-pane-header">
                  {pane.kind !== "terminal" ? (
                    <ModeTabs
                      label="오른쪽 화면 탭"
                      selected={pane.kind}
                      select={(kind) => {
                        workbench.ensure(kind, false);
                        requestAnimationFrame(() =>
                          document
                            .getElementById(`pane-${kind}`)
                            ?.querySelector<HTMLElement>(
                              '.pane-mode-tabs [aria-selected="true"]',
                            )
                            ?.focus(),
                        );
                      }}
                      items={[
                        {
                          id: "browser",
                          label: "브라우저",
                          panel: "pane-browser",
                          icon: <GlobeIcon />,
                        },
                        {
                          id: "app",
                          label: "앱 화면",
                          panel: "pane-app",
                          icon: <CubeIcon />,
                        },
                      ]}
                    >
                      {paneActions(pane.id, title)}
                    </ModeTabs>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="pane-focus"
                        onClick={() => workbench.focus(pane.id)}
                      >
                        {pane.kind === "terminal" ? (
                          <CodeIcon />
                        ) : pane.kind === "browser" ? (
                          <GlobeIcon />
                        ) : (
                          <CubeIcon />
                        )}
                        <strong>{title}</strong>
                        <span className="pane-focus-mark" aria-hidden="true">
                          {workbench.focused === pane.id ? "●" : ""}
                        </span>
                      </button>
                      {paneActions(pane.id, title)}
                    </>
                  )}
                </header>
              )}
              <div className="workbench-pane-body">
                {pane.id === "terminal" && (
                  <MainPane
                    space={space}
                    terminals={workbench.scopedTerminals(pane.id)}
                    openUrl={openUrl}
                    openApp={async (id) => {
                      if (workbench.ensure("app"))
                        await application.run(() =>
                          window.connectors.open(id, "app"),
                        );
                    }}
                    actions={paneActions(pane.id, title)}
                    ref={(handle) => {
                      if (handle)
                        workbench.handles.current.set(pane.id, handle);
                      else workbench.handles.current.delete(pane.id);
                    }}
                  />
                )}
                {pane.kind === "terminal" && pane.id !== "terminal" && (
                  <TerminalPanel
                    space={space}
                    terminals={workbench.scopedTerminals(pane.id)}
                    openUrl={openUrl}
                    ref={(handle) => {
                      if (handle)
                        workbench.handles.current.set(pane.id, handle);
                      else workbench.handles.current.delete(pane.id);
                    }}
                  />
                )}
                {pane.kind === "browser" && (
                  <BrowserPane
                    browser={browser}
                    visible={nativeVisible && shown}
                    boundsKey={workbench.boundsKey}
                    ref={(handle) => {
                      if (handle)
                        workbench.handles.current.set(pane.id, handle);
                      else workbench.handles.current.delete(pane.id);
                    }}
                  />
                )}
                {pane.kind === "app" && (
                  <BrowserPane
                    browser={application}
                    app
                    visible={nativeVisible && shown}
                    boundsKey={workbench.boundsKey}
                    ref={(handle) => {
                      if (handle)
                        workbench.handles.current.set(pane.id, handle);
                      else workbench.handles.current.delete(pane.id);
                    }}
                  />
                )}
              </div>
            </section>
          );
        })}
        {!workbench.zoom &&
          workbench.dividers.map((divider) => (
            <Splitter
              key={divider.id}
              divider={divider}
              canvas={workbench.canvas}
              resize={workbench.resize}
              dragging={workbench.setDragging}
            />
          ))}
      </div>
      {workbench.dialog && (
        <WorkbenchDialog
          kind={workbench.dialog}
          spaces={spaces}
          sessions={terminals.sessions}
          close={workbench.closeDialog}
          selectSpace={(id) => {
            selectSpace(id);
            workbench.closeDialog();
          }}
          selectSession={(session) => {
            selectSpace(session.spaceId);
            terminals.setSelected(session.id);
            workbench.closeDialog();
          }}
        />
      )}
    </section>
  );
}
