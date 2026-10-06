import type { Provider } from "./proxy";

export const agentNames: Record<Provider, string> = {
  codex: "Codex",
  claude: "Claude Code",
  antigravity: "Antigravity",
};

export type AgentStatus = {
  readonly id: Provider;
  readonly phase:
    | "checking"
    | "missing"
    | "installed"
    | "installing"
    | "failed"
    | "unsupported";
  readonly path: string | null;
  readonly version: string | null;
  readonly message: string;
  readonly log: string;
};

export interface AgentBridge {
  readonly snapshot: () => Promise<readonly AgentStatus[]>;
  readonly refresh: () => Promise<readonly AgentStatus[]>;
  readonly install: (id: Provider) => Promise<readonly AgentStatus[]>;
  readonly cancel: (id: Provider) => Promise<readonly AgentStatus[]>;
}

declare global {
  interface Window {
    readonly agents: AgentBridge;
  }
}
