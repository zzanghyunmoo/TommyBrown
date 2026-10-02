import { ExternalLinkIcon } from "@radix-ui/react-icons";
import type { Provider, ProxyAccount } from "../../../shared/proxy";
import { Button, Panel, Status } from "../../components/primitives";

const providers: readonly {
  id: Provider;
  name: string;
  description: string;
  mark: string;
}[] = [
  {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic 계정",
    mark: "Cl",
  },
  { id: "codex", name: "Codex", description: "ChatGPT 계정", mark: "Cx" },
  {
    id: "antigravity",
    name: "Antigravity",
    description: "Google 계정",
    mark: "Ag",
  },
];
export function Providers({
  accounts,
  available,
  login,
}: {
  readonly accounts: readonly ProxyAccount[];
  readonly available: boolean;
  readonly login: (provider: Provider) => void;
}) {
  return (
    <Panel
      title="연결된 계정"
      description="브라우저에서 로그인하면 계정에서 제공하는 모델을 불러옵니다."
    >
      {providers.map((provider) => {
        const connected = accounts.filter(
          (account) =>
            account.provider === provider.id ||
            (provider.id === "claude" && account.provider === "anthropic"),
        );
        return (
          <div key={provider.id} className="provider-row">
            <span className="provider-mark" aria-hidden="true">
              {provider.mark}
            </span>
            <div className="provider-copy">
              <h3>{provider.name}</h3>
              <p>{provider.description}</p>
              {connected.map((account) => (
                <div className="account-line" key={account.name}>
                  <span title={account.email}>
                    {account.email || account.name}
                  </span>
                  <Status
                    tone={
                      account.disabled || account.status !== "active"
                        ? "pending"
                        : "success"
                    }
                  >
                    {account.disabled
                      ? "비활성"
                      : account.status === "active"
                        ? "연결됨"
                        : account.status}
                  </Status>
                </div>
              ))}
            </div>
            {connected.length === 0 && <Status>연결 전</Status>}
            <Button
              disabled={!available}
              onClick={() => login(provider.id)}
              aria-label={`${provider.name} 계정 연결`}
            >
              <ExternalLinkIcon aria-hidden="true" />
              {connected.length ? "계정 추가" : "연결"}
            </Button>
          </div>
        );
      })}
    </Panel>
  );
}
