import { useEffect, useRef, useState } from "react";
import type { TerminalInfo } from "../../../shared/terminal";
import { shortcuts } from "../../../shared/workbench";
import type { Space } from "../../../shared/workspace";
import { Button } from "../../components/primitives";

export function WorkbenchDialog({
  kind,
  spaces,
  sessions,
  close,
  selectSpace,
  selectSession,
}: {
  readonly kind: "help" | "spaces" | "sessions";
  readonly spaces: readonly Space[];
  readonly sessions: readonly TerminalInfo[];
  readonly close: () => void;
  readonly selectSpace: (id: string) => void;
  readonly selectSession: (session: TerminalInfo) => void;
}) {
  const host = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    host.current?.showModal();
  }, []);
  const matches = (value: string) =>
    value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const title =
    kind === "help"
      ? "Herdr 단축키"
      : kind === "spaces"
        ? "공간 탐색"
        : "세션 탐색";
  return (
    <dialog
      ref={host}
      className="workbench-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <Button tone="quiet" onClick={close}>
          닫기 · Esc
        </Button>
      </header>
      {kind === "help" && (
        <p>
          <kbd>Ctrl+B</kbd>를 누른 뒤 다음 키를 누르세요. 대문자는 Shift와 함께
          누릅니다.
        </p>
      )}
      <input
        aria-label="목록 검색"
        placeholder="검색…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="workbench-dialog-list">
        {kind === "help" && (
          <>
            <dl>
              {shortcuts
                .filter((item) => matches(`${item.key} ${item.label}`))
                .map((item) => (
                  <div key={item.command}>
                    <dt>
                      <kbd>{item.key}</kbd>
                    </dt>
                    <dd>{item.label}</dd>
                  </div>
                ))}
            </dl>
            <p>
              크기 조절: h/j/k/l 또는 방향키. Enter·Esc로 종료.
              <br />
              Ctrl+B를 두 번 누르면 앱에 Ctrl+B가 전달됩니다.
            </p>
          </>
        )}
        {kind === "spaces" &&
          spaces
            .filter((space) => matches(space.name))
            .map((space) => (
              <button
                type="button"
                className="workbench-choice"
                key={space.id}
                onClick={() => selectSpace(space.id)}
              >
                {space.name}
              </button>
            ))}
        {kind === "sessions" &&
          sessions
            .filter((session) =>
              matches(
                `${session.cli} ${spaces.find((space) => space.id === session.spaceId)?.name ?? ""}`,
              ),
            )
            .map((session, index) => (
              <button
                type="button"
                className="workbench-choice"
                key={session.id}
                onClick={() => selectSession(session)}
              >
                <span>
                  {session.cli} {index + 1}
                </span>
                <small>
                  {spaces.find((space) => space.id === session.spaceId)?.name} ·{" "}
                  {session.phase === "running" ? "실행 중" : "종료"}
                </small>
              </button>
            ))}
        {kind === "sessions" && !sessions.length && (
          <p>열린 세션이 없습니다.</p>
        )}
      </div>
    </dialog>
  );
}
