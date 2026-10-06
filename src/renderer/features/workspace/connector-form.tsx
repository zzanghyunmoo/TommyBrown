import { useState } from "react";
import {
  type ConnectorInput,
  connectorInputSchema,
  connectorPresets,
} from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";

export function ConnectorForm({
  add,
  busy,
}: {
  readonly add: (input: ConnectorInput, form: HTMLFormElement) => void;
  readonly busy: boolean;
}) {
  const [kind, setKind] = useState("browser");
  const [error, setError] = useState<string>();
  const preset =
    connectorPresets.find((item) => item.kind === kind) ?? connectorPresets[0];
  return (
    <form
      className="connector-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(undefined);
        try {
          add(
            connectorInputSchema.parse({
              kind,
              name: data.get("name"),
              webUrl: data.get("webUrl"),
              endpoint: data.get("endpoint") || null,
              token: data.get("token") || null,
            }),
            form,
          );
        } catch (failure) {
          if (failure instanceof Error) setError(failure.message);
          else throw failure;
        }
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
      {kind === "memory" ? (
        <>
          <input type="hidden" name="webUrl" value={preset.url} />
          <p>
            이 컴퓨터에 지식과 관계를 저장하는 Memory MCP입니다. 별도 설치나
            로그인이 필요 없으며, 기억은 앱을 다시 켜도 유지됩니다.
          </p>
        </>
      ) : (
        <>
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
          <details key={kind} open={kind === "context7"}>
            <summary>MCP 데이터·도구 연결 (선택)</summary>
            <p>
              {kind === "context7"
                ? "라이브러리 문서를 검색하는 Context7 공식 서버입니다. 토큰 없이 시작할 수 있고, 사용량 제한이 걸리면 API 키를 액세스 토큰에 입력하세요."
                : "서비스 또는 신뢰하는 어댑터의 Streamable HTTP 주소를 입력하세요. 웹 로그인과 별도의 인증입니다."}
            </p>
            <label>
              MCP 주소
              <input
                name="endpoint"
                type="url"
                defaultValue={
                  kind === "context7" ? "https://mcp.context7.com/mcp" : ""
                }
                placeholder="https://your-server.example/mcp"
              />
            </label>
            <label>
              액세스 토큰
              <input name="token" type="password" autoComplete="off" />
            </label>
            <p>
              토큰은 이 컴퓨터의 OS 암호화 저장소로 보호됩니다. OAuth 전용
              서버는 발급된 토큰 또는 로컬 어댑터가 필요합니다.
            </p>
          </details>
        </>
      )}
      <Button type="submit" busy={busy}>
        커넥터 추가
      </Button>
      {error && <Notice error>{error}</Notice>}
    </form>
  );
}
