import { useState } from "react";
import {
  allowsTool,
  type Connector,
  type ConnectorTool,
  connectorCallSchema,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";

export function ConnectorTools({
  connector,
  tools,
}: {
  readonly connector: Connector;
  readonly tools: readonly ConnectorTool[];
}) {
  const [selected, setSelected] = useState("");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const tool = tools.find((item) => item.name === selected) ?? tools[0];
  async function call() {
    if (!tool) return;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const request = connectorCallSchema.parse({
        id: connector.id,
        name: tool.name,
        arguments: JSON.parse(args),
      });
      setResult(await window.connectors.call(request));
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connector-tools">
      <p>{tools.length}개 도구</p>
      {tool && (
        <>
          <label>
            도구
            <select
              value={tool.name}
              onChange={(event) => {
                setSelected(event.target.value);
                setResult(undefined);
              }}
            >
              {tools.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p>{tool.description}</p>
          <details>
            <summary>입력 형식</summary>
            <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
          </details>
          <label>
            인수 (JSON)
            <textarea
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              rows={4}
              maxLength={65536}
              spellCheck={false}
            />
          </label>
          {!tool.readOnly && (
            <p>이 도구는 연결된 서비스의 데이터를 변경할 수 있습니다.</p>
          )}
          <Button
            busy={busy}
            disabled={!allowsTool(connector, tool.name)}
            onClick={() => {
              void call();
            }}
          >
            도구 실행
          </Button>
          {!allowsTool(connector, tool.name) && (
            <p>저장된 권한에서 차단한 도구입니다.</p>
          )}
        </>
      )}
      {error && <Notice error>{error}</Notice>}
      {result && (
        <section aria-label="도구 실행 결과">
          <pre>{result}</pre>
        </section>
      )}
    </div>
  );
}
