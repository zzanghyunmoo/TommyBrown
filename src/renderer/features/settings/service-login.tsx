import { useEffect, useState } from "react";
import type { Connector, ServiceAuthStatus } from "../../../shared/connectors";
import { Button, Notice } from "../../components/primitives";
import { publishConnectors } from "../workspace/use-connector-registry";

export function ServiceLogin({
  connector,
  checkedAt,
}: {
  readonly connector: Connector;
  readonly checkedAt: string | undefined;
}) {
  const [status, setStatus] = useState<ServiceAuthStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const waiting = status?.state === "waiting" || status?.state === "exchanging";
  useEffect(() => {
    if (checkedAt && !waiting) setError(undefined);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await window.connectors.loginStatus(connector.id);
        if (!active) return;
        setStatus(next);
        if (next.state === "waiting" || next.state === "exchanging")
          timer = setTimeout(() => {
            void poll();
          }, 1500);
      } catch (failure) {
        if (active && failure instanceof Error) setError(failure.message);
      }
    }
    if (waiting)
      timer = setTimeout(() => {
        void poll();
      }, 250);
    else void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connector.id, waiting, checkedAt]);
  useEffect(() => {
    if (status?.state !== "connected") return;
    let active = true;
    void window.connectors.list().then(
      (list) => {
        if (active) publishConnectors(list);
      },
      (failure: unknown) => {
        if (active && failure instanceof Error) setError(failure.message);
      },
    );
    return () => {
      active = false;
    };
  }, [status?.state]);
  async function run(action: () => Promise<ServiceAuthStatus>) {
    setBusy(true);
    setError(undefined);
    try {
      setStatus(await action());
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="service-login">
      <p aria-live="polite">{status?.message ?? "인증 상태 확인 중"}</p>
      <div className="connector-actions">
        <Button
          busy={busy}
          disabled={waiting}
          onClick={() => {
            void run(() => window.connectors.login(connector.id));
          }}
        >
          {connector.authenticated ? "계정 다시 연결" : "계정 연결"}
        </Button>
        {waiting && (
          <Button
            disabled={busy}
            tone="quiet"
            onClick={() => {
              void run(() => window.connectors.cancelLogin(connector.id));
            }}
          >
            로그인 취소
          </Button>
        )}
      </div>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
