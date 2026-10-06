import { useState } from "react";
import { isMcpConnector } from "../../../shared/connectors";
import { Notice } from "../../components/primitives";
import { useConnectorRegistry } from "./use-connector-registry";

export function TerminalConnectors({
  selected,
  change,
  disabled,
}: {
  readonly selected: readonly string[];
  readonly change: (ids: readonly string[]) => void;
  readonly disabled: boolean;
}) {
  const [error, setError] = useState<string>();
  const list = useConnectorRegistry(setError).filter(isMcpConnector);
  return (
    <details className="terminal-connectors">
      <summary>이 세션의 도구 연결 · {selected.length}개</summary>
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
      {!list.length && (
        <p>설정의 커넥터 또는 MCP 게이트웨이에서 연결을 추가하세요.</p>
      )}
      <p>
        선택한 도구 연결은 새 CLI 세션에서 사용합니다. 연결을 제거하면 해당
        연결을 사용하는 터미널도 종료됩니다.
      </p>
    </details>
  );
}
