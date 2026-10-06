import { useEffect, useState } from "react";
import {
  connectorInputSchema,
  isMcpConnector,
  isServiceConnector,
  type McpGatewayStatus,
  mcpPresets,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import {
  publishConnectors,
  useConnectorRegistry,
} from "../workspace/use-connector-registry";
import { ToolConnectionCard } from "./tool-connection-card";

export function McpPane() {
  const [kind, setKind] = useState("context7");
  const [gateway, setGateway] = useState<McpGatewayStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const connectors = useConnectorRegistry(setError).filter(
    (item) => isMcpConnector(item) && !isServiceConnector(item),
  );
  const preset = mcpPresets.find((item) => item.kind === kind) ?? mcpPresets[0];
  useEffect(() => {
    let active = true;
    void window.connectors.gateway().then(
      (status) => {
        if (active) setGateway(status);
      },
      (failure: unknown) => {
        if (active && failure instanceof Error) setError(failure.message);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  async function add(form: HTMLFormElement) {
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData(form);
      publishConnectors(
        await window.connectors.add(
          connectorInputSchema.parse({
            kind,
            name: data.get("name"),
            webUrl: null,
            endpoint: data.get("endpoint") || null,
            token: data.get("token") || null,
          }),
        ),
      );
      form.reset();
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connector-pane" aria-label="MCP 서버 설정">
      <header className="page-heading">
        <div>
          <span className="eyebrow">설정</span>
          <h1>MCP 게이트웨이</h1>
          <p>서비스 커넥터와 MCP 서버의 허용된 도구를 CLI 세션에 전달합니다.</p>
        </div>
      </header>
      <p role="status">
        MCP 게이트웨이 ·{" "}
        {gateway ? (gateway.running ? "실행 중" : "중지됨") : "확인 중"}
      </p>
      <p>
        Claude Code, Codex, Antigravity는 터미널에서 선택한 도구 연결을
        사용합니다. 앱 안 셸에서 실행한 CLI에도 적용됩니다.
      </p>
      <p>
        Antigravity 1.2.17의 OpenAI 모델 경로는 도구 목록만 표시하며 CLI
        제약으로 도구 호출을 지원하지 않습니다.
      </p>
      {error && <Notice error>{error}</Notice>}
      <form
        className="connector-form"
        onSubmit={(event) => {
          event.preventDefault();
          void add(event.currentTarget);
        }}
      >
        <label>
          MCP 종류
          <select
            aria-label="MCP 종류"
            value={kind}
            disabled={busy}
            onChange={(event) => setKind(event.target.value)}
          >
            {mcpPresets.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          서버 이름
          <input
            key={`${kind}-name`}
            name="name"
            defaultValue={preset.name}
            required
            maxLength={80}
          />
        </label>
        {kind === "memory" ? (
          <p>
            별도 설치나 로그인 없이 이 컴퓨터에 기억을 저장합니다. 앱을 다시
            켜도 유지됩니다.
          </p>
        ) : (
          <>
            {kind === "context7" && (
              <p>
                라이브러리 문서를 검색하는 Context7 공식 서버입니다. 토큰 없이
                시작할 수 있습니다.
              </p>
            )}
            <label>
              MCP 주소
              <input
                key={`${kind}-endpoint`}
                name="endpoint"
                type="url"
                defaultValue={preset.endpoint ?? ""}
                required
              />
            </label>
            <label>
              Bearer 액세스 토큰
              <input name="token" type="password" autoComplete="off" />
            </label>
            <p>
              Streamable HTTP 서버용입니다. Slack·Atlassian의 계정 인증은 커넥터
              설정에서 진행하세요.
            </p>
          </>
        )}
        <Button type="submit" busy={busy}>
          MCP 서버 추가
        </Button>
      </form>
      {connectors.map((connector) => (
        <ToolConnectionCard key={connector.id} connector={connector} />
      ))}
    </section>
  );
}
