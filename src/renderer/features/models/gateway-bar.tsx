import { CheckCircledIcon, PlayIcon, StopIcon } from "@radix-ui/react-icons";
import type { ModelSnapshot } from "../../../shared/bridge";
import { Button, Status } from "../../components/primitives";

export function GatewayBar({
  snapshot,
  busy,
  run,
  stop,
}: {
  readonly snapshot: ModelSnapshot | undefined;
  readonly busy: string | undefined;
  readonly run: (name: string, action?: () => Promise<void>) => Promise<void>;
  readonly stop: () => Promise<void>;
}) {
  const running = snapshot?.gateway.phase === "running";
  const port =
    snapshot?.gateway.phase === "running" ? snapshot.gateway.port : undefined;
  return (
    <section className="gateway-bar" aria-label="로컬 게이트웨이">
      <div className="gateway-symbol">
        <CheckCircledIcon width={24} height={24} />
      </div>
      <div className="gateway-copy">
        <h2>로컬 게이트웨이</h2>
        <p>
          {port
            ? `127.0.0.1:${port}`
            : snapshot?.installed
              ? `CLIProxyAPI ${snapshot.version} 설치됨`
              : "모델 요청을 이 컴퓨터에서 연결합니다"}
        </p>
      </div>
      <Status tone={running ? "success" : "neutral"}>
        {running ? "실행 중" : "정지됨"}
      </Status>
      {!snapshot?.installed ? (
        <Button
          tone="primary"
          busy={busy === "install"}
          disabled={!snapshot || !!busy}
          onClick={() => {
            void run("install", () => window.desktop.install());
          }}
        >
          {busy === "install" ? "다운로드·검증 중…" : "엔진 설치"}
        </Button>
      ) : running ? (
        <Button
          disabled={!!busy}
          onClick={() => {
            void stop();
          }}
        >
          <StopIcon />
          중지
        </Button>
      ) : (
        <Button
          tone="primary"
          busy={busy === "start"}
          disabled={!!busy}
          onClick={() => {
            void run("start", () => window.desktop.start());
          }}
        >
          <PlayIcon />
          {busy === "start" ? "시작 중…" : "게이트웨이 시작"}
        </Button>
      )}
    </section>
  );
}
