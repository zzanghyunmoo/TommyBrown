import { useState } from "react";
import {
  isServiceConnector,
  serviceInputSchema,
  servicePresets,
  serviceRedirectUrl,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import {
  publishConnectors,
  useConnectorRegistry,
} from "../workspace/use-connector-registry";
import { ToolConnectionCard } from "./tool-connection-card";

export function ServiceConnectors() {
  const [kind, setKind] = useState("atlassian-service");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const connectors = useConnectorRegistry(setError).filter(isServiceConnector);
  const preset =
    servicePresets.find((item) => item.kind === kind) ?? servicePresets[1];
  async function add(form: HTMLFormElement) {
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData(form);
      const input = serviceInputSchema.parse({
        kind,
        name: data.get("name"),
        ...(kind === "slack-service"
          ? {
              clientId: data.get("clientId"),
              clientSecret: data.get("clientSecret"),
            }
          : {}),
      });
      publishConnectors(await window.connectors.addService(input));
      form.reset();
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connector-pane" aria-label="서비스 커넥터 설정">
      <header className="page-heading">
        <div>
          <span className="eyebrow">설정</span>
          <h1>커넥터</h1>
          <p>
            계정을 연결하면 에이전트가 서비스의 검색·조회·작업 도구를 사용할 수
            있습니다.
          </p>
        </div>
      </header>
      <p>
        계정 연결 → 도구 확인 → 허용할 도구 선택 → 터미널의 ‘이 세션의 도구
        연결’에서 선택하세요.
      </p>
      <p>
        새 커넥터의 도구는 기본 차단됩니다. 선택한 도구는 MCP 게이트웨이를 통해
        CLI에 전달됩니다.
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
          서비스
          <select
            aria-label="서비스"
            value={kind}
            disabled={busy}
            onChange={(event) => setKind(event.target.value)}
          >
            {servicePresets.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          연결 이름
          <input
            key={kind}
            name="name"
            defaultValue={preset.name}
            required
            maxLength={80}
          />
        </label>
        {kind === "slack-service" ? (
          <>
            <p>
              Slack에 등록한 내부 앱 또는 승인된 앱의 OAuth 정보를 입력하세요.
              앱 설정의 Redirect URL에 아래 주소를 등록해야 합니다.
            </p>
            <code className="connector-address">{serviceRedirectUrl}</code>
            <label>
              Slack Client ID
              <input name="clientId" required autoComplete="off" />
            </label>
            <label>
              Slack Client Secret
              <input
                name="clientSecret"
                type="password"
                required
                autoComplete="off"
              />
            </label>
            <p>앱 정보와 계정 토큰은 OS 암호화 저장소에 보관합니다.</p>
          </>
        ) : (
          <p>
            Jira·Confluence를 사용하는 Atlassian 계정으로 연결합니다.
            브라우저에서 허용할 사이트와 권한을 승인하세요.
          </p>
        )}
        <Button type="submit" busy={busy}>
          커넥터 추가
        </Button>
      </form>
      {connectors.map((connector) => (
        <ToolConnectionCard key={connector.id} connector={connector} />
      ))}
      {!connectors.length && (
        <p className="pane-empty">연결할 서비스를 추가하세요.</p>
      )}
    </section>
  );
}
