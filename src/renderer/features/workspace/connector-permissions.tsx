import { useState } from "react";
import type { Connector, ConnectorTool } from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";

export function ConnectorPermissions({
  connector,
  tools,
  save,
}: {
  readonly connector: Connector;
  readonly tools: readonly ConnectorTool[];
  readonly save: (allowedTools: readonly string[] | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState<readonly string[] | null>(
    connector.allowedTools,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dirty =
    JSON.stringify(selected) !== JSON.stringify(connector.allowedTools);
  const allowed =
    selected === null
      ? tools.length
      : tools.filter((tool) => selected.includes(tool.name)).length;
  async function persist() {
    setBusy(true);
    setError(undefined);
    try {
      await save(selected);
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
      else throw failure;
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="connector-permissions" disabled={busy}>
      <legend>에이전트 도구 권한</legend>
      <p>
        {allowed} / {tools.length}개 허용 ·{" "}
        {selected === null ? "새 도구도 자동 허용" : "선택한 도구만 허용"}
      </p>
      <div className="connector-actions">
        <Button tone="quiet" onClick={() => setSelected(null)}>
          전체 허용
        </Button>
        <Button tone="quiet" onClick={() => setSelected([])}>
          전체 차단
        </Button>
      </div>
      <div className="connector-permission-list">
        {tools.map((tool) => (
          <label key={tool.name} className="connector-tool-option">
            <input
              type="checkbox"
              checked={selected === null || selected.includes(tool.name)}
              onChange={(event) => {
                const names = selected ?? tools.map((item) => item.name);
                setSelected(
                  event.target.checked
                    ? [...names, tool.name]
                    : names.filter((name) => name !== tool.name),
                );
              }}
            />
            <span>
              <strong>{tool.name}</strong>
              <span>{tool.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="connector-actions">
        <Button disabled={!dirty} busy={busy} onClick={() => void persist()}>
          권한 저장
        </Button>
        <span role="status">
          {dirty ? "저장하지 않은 변경" : "저장된 권한 적용 중"}
        </span>
      </div>
      <p>
        저장하면 현재 세션에도 호출 제한이 적용됩니다. 도구 목록이 이전 상태라면
        새 세션을 여세요. 이미 실행 중인 작업은 취소되지 않습니다.
      </p>
      {error && <Notice error>{error}</Notice>}
    </fieldset>
  );
}
