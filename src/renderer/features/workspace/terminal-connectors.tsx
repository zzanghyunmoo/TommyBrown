import { useState } from "react";
import type { Connector } from "../../../shared/connectors";
import { Notice } from "../../components/primitives";

export function TerminalConnectors({
  selected,
  change,
  disabled,
}: {
  readonly selected: readonly string[];
  readonly change: (ids: readonly string[]) => void;
  readonly disabled: boolean;
}) {
  const [list, setList] = useState<readonly Connector[]>([]);
  const [error, setError] = useState<string>();
  return (
    <details
      className="terminal-connectors"
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        void window.connectors
          .list()
          .then((next) => {
            setList(next.filter((item) => item.endpoint));
            setError(undefined);
          })
          .catch((failure: unknown) => {
            if (failure instanceof Error) setError(failure.message);
          });
      }}
    >
      <summary>이 세션의 커넥터 · {selected.length}개</summary>
      {error && <Notice error>{error}</Notice>}
      {list.map((connector) => (
        <label key={connector.id}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={selected.includes(connector.id)}
            onChange={(event) =>
              change(
                event.target.checked
                  ? [...selected, connector.id]
                  : selected.filter((id) => id !== connector.id),
              )
            }
          />
          {connector.name}
        </label>
      ))}
      {!list.length && <p>커넥터 탭에서 MCP 연결을 추가하세요.</p>}
      <p>
        선택한 연결은 새 CLI 세션에서 사용합니다. 연결을 해제하면 해당 연결을
        사용하는 터미널도 종료됩니다.
      </p>
    </details>
  );
}
