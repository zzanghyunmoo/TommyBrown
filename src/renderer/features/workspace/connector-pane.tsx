import { useState } from "react";
import { isMcpConnector } from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import { ConnectorForm } from "./connector-form";
import {
  publishConnectors,
  useConnectorRegistry,
} from "./use-connector-registry";

export function ConnectorPane({
  openWeb,
}: {
  readonly openWeb: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const apps = useConnectorRegistry(setError).filter(
    (item) => !isMcpConnector(item),
  );
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
  return (
    <section className="connector-pane" aria-label="웹 앱 설정">
      <header>
        <h2>웹 앱</h2>
        <p>
          서비스 웹 화면을 오른쪽에 엽니다. 로그인은 웹 앱마다 별도로
          보관합니다.
        </p>
        <p>
          에이전트가 서비스 도구를 사용하려면 설정의 커넥터에서 계정을
          연결하세요.
        </p>
      </header>
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
      {!apps.length && <p className="pane-empty">작업할 웹 앱을 추가하세요.</p>}
      {apps.map((app) => (
        <article key={app.id} className="connector-card">
          <header>
            <h3>{app.name}</h3>
            <span>웹 앱</span>
          </header>
          <p className="connector-address">{app.webUrl}</p>
          <div className="connector-actions">
            <Button
              disabled={busy}
              onClick={() => {
                void run(() => openWeb(app.id));
              }}
            >
              웹 화면 열기
            </Button>
            <Button
              tone="quiet"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `${app.name}의 웹 화면과 저장된 웹 로그인을 지울까요?`,
                  )
                )
                  return;
                void run(async () => {
                  publishConnectors(await window.connectors.disconnect(app.id));
                });
              }}
            >
              웹 앱 제거
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
