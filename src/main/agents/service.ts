import { type AgentStatus, agentNames } from "../../shared/agents";
import { type Provider, providerSchema } from "../../shared/proxy";
import { installAgent, probeAgent } from "./installer";
import { cleanOutput } from "./process";

type Dependencies = {
  readonly probe: (
    id: Provider,
    signal: AbortSignal,
  ) => Promise<{ path: string; version: string } | null>;
  readonly install: (
    id: Provider,
    signal: AbortSignal,
    log: (text: string) => void,
  ) => Promise<void>;
};

export class AgentService {
  private readonly states = new Map<Provider, AgentStatus>();
  private readonly lifetime = new AbortController();
  private refreshTask: Promise<readonly AgentStatus[]> | undefined;
  private job:
    | { id: Provider; controller: AbortController; done: Promise<void> }
    | undefined;

  constructor(
    private readonly dependencies: Dependencies = {
      probe: probeAgent,
      install: installAgent,
    },
    private readonly supported = ["win32", "darwin"].includes(
      process.platform,
    ) && ["x64", "arm64"].includes(process.arch),
  ) {
    for (const id of ["codex", "claude", "antigravity"] as const)
      this.states.set(id, {
        id,
        phase: supported ? "checking" : "unsupported",
        path: null,
        version: null,
        message: supported
          ? "설치 확인 중"
          : "이 OS에서는 자동 설치를 지원하지 않습니다.",
        log: "",
      });
  }

  snapshot(): readonly AgentStatus[] {
    return [...this.states.values()];
  }

  private set(id: Provider, update: Partial<AgentStatus>): void {
    const previous = this.states.get(id);
    if (previous) this.states.set(id, { ...previous, ...update });
  }

  refresh(): Promise<readonly AgentStatus[]> {
    if (this.job || !this.supported || this.lifetime.signal.aborted)
      return Promise.resolve(this.snapshot());
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = Promise.all(
      this.snapshot().map(async ({ id }) => {
        this.set(id, { phase: "checking" });
        try {
          const result = await this.dependencies.probe(
            id,
            this.lifetime.signal,
          );
          this.set(id, {
            phase: result ? "installed" : "missing",
            path: result?.path ?? null,
            version: result?.version ?? null,
            message: result ? "설치됨" : "설치되지 않음",
          });
        } catch (error) {
          this.set(id, {
            phase: "failed",
            message: error instanceof Error ? error.message : "설치 확인 실패",
          });
        }
      }),
    )
      .then(() => this.snapshot())
      .finally(() => {
        this.refreshTask = undefined;
      });
    return this.refreshTask;
  }

  start(input: unknown): readonly AgentStatus[] {
    const id = providerSchema.parse(input);
    if (this.lifetime.signal.aborted) throw new Error("앱이 종료 중입니다.");
    if (!this.supported)
      throw new Error("이 OS에서는 자동 설치를 지원하지 않습니다.");
    if (this.job) throw new Error("다른 설치가 진행 중입니다.");
    const controller = new AbortController();
    const log = (text: string) =>
      this.set(id, {
        log: cleanOutput((this.states.get(id)?.log ?? "") + text),
      });
    this.set(id, {
      phase: "installing",
      message: "기존 설치 확인 중…",
      log: "",
    });
    const done = Promise.resolve()
      .then(async () => {
        await this.refreshTask;
        controller.signal.throwIfAborted();
        this.set(id, { phase: "installing", message: "기존 설치 확인 중…" });
        let result = await this.dependencies.probe(id, controller.signal);
        controller.signal.throwIfAborted();
        if (!result) {
          this.set(id, { message: `${agentNames[id]} 설치 중…` });
          await this.dependencies.install(id, controller.signal, log);
          controller.signal.throwIfAborted();
          this.set(id, { message: "설치된 CLI 실행 확인 중…" });
          result = await this.dependencies.probe(id, controller.signal);
          if (!result)
            throw new Error(
              "설치 프로그램이 끝났지만 실행 파일을 찾지 못했습니다. 설치 로그를 확인하세요.",
            );
        }
        controller.signal.throwIfAborted();
        this.set(id, {
          phase: "installed",
          ...result,
          message: "설치됨 · 새 세션에서 사용할 수 있습니다.",
        });
      })
      .catch((error: unknown) => {
        this.set(id, {
          phase: "failed",
          message: controller.signal.aborted
            ? "설치를 취소했습니다. 다시 확인하거나 재시도할 수 있습니다."
            : error instanceof Error
              ? error.message
              : "설치 실패",
        });
      })
      .finally(() => {
        this.job = undefined;
      });
    this.job = { id, controller, done };
    return this.snapshot();
  }

  async cancel(input: unknown): Promise<readonly AgentStatus[]> {
    const id = providerSchema.parse(input);
    if (this.job?.id === id) {
      this.job.controller.abort();
      await this.job.done;
    }
    return this.snapshot();
  }

  async stop(): Promise<void> {
    this.lifetime.abort();
    this.job?.controller.abort();
    await Promise.allSettled([this.job?.done, this.refreshTask]);
  }
}
