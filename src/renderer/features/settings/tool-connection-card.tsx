import { useState } from "react";
import {
  type Connector,
  type ConnectorCheck,
  isServiceConnector,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import { ConnectorPermissions } from "../workspace/connector-permissions";
import { ConnectorTools } from "../workspace/connector-tools";
import { publishConnectors } from "../workspace/use-connector-registry";
import { ServiceLogin } from "./service-login";

export function ToolConnectionCard({
  connector,
}: {
  readonly connector: Connector;
}) {
  const [check, setCheck] = useState<ConnectorCheck>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
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
  const service = isServiceConnector(connector);
  return (
    <article className="connector-card">
      <header>
        <h3>{connector.name}</h3>
        <span>{service ? "서비스 커넥터" : "MCP 서버"}</span>
      </header>
      <p className="connector-address">
        {connector.kind === "memory"
          ? "로컬 Memory · 이 컴퓨터에 기억 저장"
          : connector.endpoint}
      </p>
      {service ? (
        <ServiceLogin connector={connector} checkedAt={check?.checkedAt} />
      ) : (
        <p>{connector.hasToken ? "토큰 저장됨" : "별도 인증 정보 없음"}</p>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="connector-actions">
        <Button
          busy={busy}
          disabled={service && !connector.authenticated}
          onClick={() => {
            void run(async () => {
              setCheck(await window.connectors.check(connector.id));
            });
          }}
        >
          도구 확인
        </Button>
        <Button
          tone="quiet"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                `${connector.name}를 사용하는 터미널을 종료하고 이 연결의 인증 정보를 지울까요?${connector.kind === "memory" ? " 기억 파일은 이 컴퓨터에 보관됩니다." : ""}`,
              )
            )
              return;
            void run(async () => {
              publishConnectors(
                await window.connectors.disconnect(connector.id),
              );
            });
          }}
        >
          연결 해제
        </Button>
      </div>
      {check && (
        <>
          <ConnectorPermissions
            connector={connector}
            tools={check.tools}
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
          <ConnectorTools connector={connector} tools={check.tools} />
        </>
      )}
    </article>
  );
}
