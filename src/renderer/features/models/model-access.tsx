import { ReloadIcon } from "@radix-ui/react-icons";
import { Button, Notice, Panel } from "../../components/primitives";
import { GatewayBar } from "./gateway-bar";
import { LaunchControls } from "./launch-controls";
import { MappingEditor } from "./mapping-editor";
import { Providers } from "./providers";
import { useModels } from "./use-models";

export function ModelAccess() {
  const { snapshot, busy, error, pending, run, login, cancel, stop } =
    useModels();
  const running = snapshot?.gateway.phase === "running";
  return (
    <div className="model-layout">
      <main className="model-main">
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR MODELS, YOUR TOOLS</span>
            <h1>모델 연결</h1>
            <p>사용 중인 계정의 모델을 다른 CLI에서도 선택하세요.</p>
          </div>
          <Button
            disabled={!!busy}
            onClick={() => {
              void run("refresh");
            }}
            aria-label="연결 상태 새로고침"
          >
            <ReloadIcon />
          </Button>
        </div>
        {error && <Notice error>{error}</Notice>}
        <GatewayBar snapshot={snapshot} busy={busy} run={run} stop={stop} />
        {snapshot?.gateway.phase === "error" && (
          <Notice error>{snapshot.gateway.message}</Notice>
        )}
        {pending && (
          <Notice>
            <div className="pending-login">
              <div>
                <strong>브라우저에서 로그인을 완료해 주세요</strong>
                <p>로그인과 계정 저장이 끝나면 자동으로 갱신됩니다.</p>
              </div>
              <div className="cluster">
                <Button
                  disabled={!!busy}
                  onClick={() => {
                    void run("reopen", () =>
                      window.desktop.reopenLogin(pending.state),
                    );
                  }}
                >
                  브라우저 다시 열기
                </Button>
                <Button
                  disabled={!!busy}
                  onClick={() => {
                    void cancel();
                  }}
                >
                  로그인 취소
                </Button>
              </div>
            </div>
          </Notice>
        )}
        <Providers
          accounts={snapshot?.accounts ?? []}
          available={running && !busy && !pending}
          login={(provider) => {
            void login(provider);
          }}
        />
        {snapshot && (
          <MappingEditor
            key={JSON.stringify(snapshot.mappings)}
            saved={snapshot.mappings}
            catalog={snapshot.providerModels}
            busy={!!busy}
            run={run}
          />
        )}
        <Panel
          title="사용 가능한 모델"
          description="실제 계정에서 제공하는 모델 목록입니다."
          action={
            <span className="count">{snapshot?.models.length ?? 0} models</span>
          }
        >
          <LaunchControls
            models={snapshot?.models ?? []}
            mappings={snapshot?.mappings}
            mappingRevision={snapshot?.mappingRevision}
            busy={!!busy}
            run={run}
          />
          {snapshot?.models.length ? (
            <div className="model-list">
              {snapshot.models.map((model) => (
                <div className="model-row" key={model.id}>
                  <code>{model.id}</code>
                  <span>{model.owned_by}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-symbol" aria-hidden="true">
                ↗
              </div>
              <h3>연결된 모델이 없습니다</h3>
              <p>
                {running
                  ? "위에서 계정을 연결하면 모델을 선택할 수 있습니다."
                  : "게이트웨이를 시작하고 계정에 로그인해 주세요."}
              </p>
            </div>
          )}
        </Panel>
      </main>
      <aside className="connection-guide">
        <span className="eyebrow">GETTING CONNECTED</span>
        <h2>계정에서 CLI까지</h2>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <h3>게이트웨이 시작</h3>
              <p>한 번 설치하면 이 컴퓨터에서 실행됩니다.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>사용하는 계정 연결</h3>
              <p>
                Claude, ChatGPT, Google 로그인은 각 제공자의 브라우저 화면에서
                진행합니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>모델과 CLI 선택</h3>
              <p>연결된 모델을 선택해 다른 CLI의 작업에도 사용합니다.</p>
            </div>
          </li>
        </ol>
        <div className="guide-note">
          <h3>로컬 연결</h3>
          <p>
            계정 인증 정보는 이 컴퓨터에 보관됩니다. 모델 요청은 선택한
            제공자에게 전달됩니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
