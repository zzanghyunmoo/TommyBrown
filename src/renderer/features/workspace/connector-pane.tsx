import { useEffect, useState } from "react";
import {
  type ConnectorCheck,
  isMcpConnector,
  type McpGatewayStatus,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import { ConnectorForm } from "./connector-form";
import { ConnectorPermissions } from "./connector-permissions";
import { ConnectorTools } from "./connector-tools";
import {
  publishConnectors,
  useConnectorRegistry,
} from "./use-connector-registry";

export function ConnectorPane({
  openWeb,
  settings = false,
}: {
  readonly openWeb?: (id: string) => Promise<void>;
  readonly settings?: boolean;
}) {
  const [checks, setChecks] = useState<
    Readonly<Record<string, ConnectorCheck>>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const connectors = useConnectorRegistry(setError);
  const [gateway, setGateway] = useState<McpGatewayStatus>();
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
  async function checkConnection(id: string) {
    const check = await window.connectors.check(id);
    setChecks((previous) => ({ ...previous, [id]: check }));
  }
  async function disconnectConnection(id: string) {
    publishConnectors(await window.connectors.disconnect(id));
    setChecks((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== id),
      ),
    );
  }
  return (
    <section className="connector-pane" aria-label="커넥터 설정">
      <header className={settings ? "page-heading" : undefined}>
        <div>
          {settings ? (
            <>
              <span className="eyebrow">설정</span>
              <h1>MCP 게이트웨이</h1>
            </>
          ) : (
            <h2>연결된 작업 도구</h2>
          )}
          <p>
            웹 로그인은 커넥터마다 별도로 보관합니다. MCP 주소를 추가하면
            데이터와 도구를 사용할 수 있습니다.
          </p>
        </div>
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
      <ConnectorForm
        busy={busy}
        add={(input, form) => {
          void run(async () => {
            publishConnectors(await window.connectors.add(input));
            form.reset();
          });
        }}
      />
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
            {connector.kind === "memory"
              ? "로컬 Memory · 이 컴퓨터에 기억 저장"
              : connector.endpoint
                ? `MCP ${checks[connector.id] ? "확인됨" : "확인 필요"} · ${connector.hasToken ? "토큰 저장됨" : "토큰 없음"}`
                : "웹 세션 · 데이터 도구 미연결"}
          </p>
          <div className="connector-actions">
            {openWeb && (
              <Button
                disabled={busy}
                onClick={() => {
                  void run(() => openWeb(connector.id));
                }}
              >
                웹 화면 열기
              </Button>
            )}
            {isMcpConnector(connector) && (
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
                    `${connector.name}를 사용하는 터미널을 종료하고 연결과 저장된 로그인 데이터를 지울까요?${connector.kind === "memory" ? " 저장된 기억 파일은 이 컴퓨터에 보관됩니다." : ""}`,
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
            <ConnectorPermissions
              key={connector.id}
              connector={connector}
              tools={checks[connector.id]?.tools ?? []}
              save={async (allowedTools) =>
                publishConnectors(
                  await window.connectors.setTools({
                    id: connector.id,
                    allowedTools:
                      allowedTools === null ? null : [...allowedTools],
                  }),
                )
              }
            />
          )}
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
