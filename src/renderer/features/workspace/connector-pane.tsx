import { useEffect, useState } from "react";
import {
  type Connector,
  type ConnectorCheck,
  connectorInputSchema,
  connectorPresets,
  type McpGatewayStatus,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import { ConnectorTools } from "./connector-tools";

export function ConnectorPane({
  openWeb,
}: {
  readonly openWeb: (id: string) => Promise<void>;
}) {
  const [connectors, setConnectors] = useState<readonly Connector[]>([]);
  const [kind, setKind] = useState("browser");
  const [checks, setChecks] = useState<
    Readonly<Record<string, ConnectorCheck>>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [gateway, setGateway] = useState<McpGatewayStatus>();
  const preset =
    connectorPresets.find((item) => item.kind === kind) ?? connectorPresets[0];
  useEffect(() => {
    let active = true;
    window.connectors
      .gateway()
      .then((status) => {
        if (active) setGateway(status);
      })
      .catch((failure: unknown) => {
        if (active && failure instanceof Error) setError(failure.message);
      });
    window.connectors
      .list()
      .then((list) => {
        if (active) setConnectors(list);
      })
      .catch((failure: unknown) => {
        if (active && failure instanceof Error) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function addConnection(form: HTMLFormElement) {
    const data = new FormData(form);
    const input = connectorInputSchema.parse({
      kind,
      name: data.get("name"),
      webUrl: data.get("webUrl"),
      endpoint: data.get("endpoint") || null,
      token: data.get("token") || null,
    });
    setConnectors(await window.connectors.add(input));
    form.reset();
  }
  async function checkConnection(id: string) {
    const check = await window.connectors.check(id);
    setChecks((previous) => ({ ...previous, [id]: check }));
  }
  async function disconnectConnection(id: string) {
    setConnectors(await window.connectors.disconnect(id));
    setChecks((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== id),
      ),
    );
  }
  return (
    <section className="connector-pane" aria-label="커넥터 설정">
      <header>
        <h2>연결된 작업 도구</h2>
        <p>
          웹 로그인은 커넥터마다 별도로 보관합니다. MCP 주소를 추가하면 데이터와
          도구를 사용할 수 있습니다.
        </p>
      </header>
      <p role="status">
        MCP 게이트웨이 ·{" "}
        {gateway ? (gateway.running ? "실행 중" : "중지됨") : "확인 중"}
      </p>
      <p>
        터미널에서 선택한 커넥터를 Claude Code, Codex, Antigravity가 공통으로
        사용합니다. PowerShell에서 실행한 CLI에도 적용됩니다.
      </p>
      <p>
        Antigravity 1.2.17을 OpenAI 모델에 연결하면 MCP 도구 목록은 표시되지만,
        CLI 제약으로 도구를 호출할 수 없습니다.
      </p>
      {error && <Notice error>{error}</Notice>}
      <form
        className="connector-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void run(() => addConnection(form));
        }}
      >
        <label>
          서비스
          <select
            aria-label="서비스"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            disabled={busy}
          >
            {connectorPresets.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          연결 이름
          <input
            key={`${kind}-name`}
            name="name"
            defaultValue={preset.name}
            required
            maxLength={80}
          />
        </label>
        <label>
          웹 앱 주소
          <input
            key={`${kind}-url`}
            name="webUrl"
            defaultValue={preset.url}
            required
            type="url"
          />
        </label>
        <details>
          <summary>MCP 데이터·도구 연결 (선택)</summary>
          <p>
            서비스 또는 신뢰하는 어댑터의 Streamable HTTP 주소를 입력하세요. 웹
            로그인과 별도의 인증입니다.
          </p>
          <label>
            MCP 주소
            <input
              name="endpoint"
              type="url"
              placeholder="https://your-server.example/mcp"
            />
          </label>
          <label>
            액세스 토큰
            <input name="token" type="password" autoComplete="off" />
          </label>
          <p>
            토큰은 이 컴퓨터의 OS 암호화 저장소로 보호됩니다. OAuth 전용 서버는
            발급된 토큰 또는 로컬 어댑터가 필요합니다.
          </p>
        </details>
        <Button type="submit" busy={busy}>
          커넥터 추가
        </Button>
      </form>
      {connectors.length === 0 && (
        <p className="pane-empty">
          연결할 서비스를 선택하세요. Obsidian은 왼쪽의 로컬 보관함에서 엽니다.
        </p>
      )}
      {connectors.map((connector) => (
        <article key={connector.id} className="connector-card">
          <header>
            <h3>{connector.name}</h3>
            <span>{connector.kind}</span>
          </header>
          <p className="connector-address">{connector.webUrl}</p>
          <p>
            {connector.endpoint
              ? `MCP ${checks[connector.id] ? "확인됨" : "확인 필요"} · ${connector.hasToken ? "토큰 저장됨" : "토큰 없음"}`
              : "웹 세션 · 데이터 도구 미연결"}
          </p>
          <div className="connector-actions">
            <Button
              disabled={busy}
              onClick={() => {
                void run(() => openWeb(connector.id));
              }}
            >
              웹 화면 열기
            </Button>
            {connector.endpoint && (
              <Button
                busy={busy}
                onClick={() => {
                  void run(() => checkConnection(connector.id));
                }}
              >
                도구 확인
              </Button>
            )}
            <Button
              tone="quiet"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `${connector.name}를 사용하는 터미널을 종료하고 연결과 저장된 로그인 데이터를 지울까요?`,
                  )
                )
                  return;
                void run(() => disconnectConnection(connector.id));
              }}
            >
              연결 해제
            </Button>
          </div>
          {checks[connector.id] && (
            <ConnectorTools
              connector={connector}
              tools={checks[connector.id]?.tools ?? []}
            />
          )}
        </article>
      ))}
    </section>
  );
}
