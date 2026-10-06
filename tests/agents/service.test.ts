import { expect, it, vi } from "vitest";
import { AgentService } from "../../src/main/agents/service";
import type { Provider } from "../../src/shared/proxy";

function fixture() {
  const installed = new Set<Provider>();
  const probe = vi.fn(async (id: Provider) =>
    installed.has(id) ? { path: `/bin/${id}`, version: `${id} 1.0.0` } : null,
  );
  const install = vi.fn(
    async (id: Provider, signal: AbortSignal, log: (text: string) => void) => {
      log("downloading");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 500);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("cancelled"));
          },
          { once: true },
        );
      });
      installed.add(id);
    },
  );
  return {
    installed,
    probe,
    install,
    service: new AgentService({ probe, install }, true),
  };
}

it("only installs missing CLIs and verifies before reporting success", async () => {
  const f = fixture();
  f.installed.add("claude");
  await f.service.refresh();
  f.service.start("claude");
  await expect
    .poll(() => f.service.snapshot().find((x) => x.id === "claude")?.phase)
    .toBe("installed");
  expect(f.install).not.toHaveBeenCalled();
  f.service.start("codex");
  expect(() => f.service.start("codex")).toThrow("진행 중");
  expect(() => f.service.start("antigravity")).toThrow("진행 중");
  await f.service.refresh();
  await expect
    .poll(() => f.service.snapshot().find((x) => x.id === "codex")?.phase)
    .toBe("installed");
  expect(f.install).toHaveBeenCalledTimes(1);
  expect(f.service.snapshot().find((x) => x.id === "codex")?.version).toBe(
    "codex 1.0.0",
  );
  await f.service.stop();
});

it("retains failure output, rejects false success, and allows retry", async () => {
  const f = fixture();
  f.install.mockImplementationOnce(async (_id, _signal, log) => {
    log("x".repeat(30_000));
  });
  f.service.start("codex");
  await expect
    .poll(() => f.service.snapshot().find((x) => x.id === "codex")?.phase)
    .toBe("failed");
  const failed = f.service.snapshot().find((x) => x.id === "codex");
  expect(failed?.message).toContain("실행 파일");
  expect(failed?.log.length).toBeLessThanOrEqual(16_000);
  f.service.start("codex");
  await expect
    .poll(() => f.service.snapshot().find((x) => x.id === "codex")?.phase)
    .toBe("installed");
  await f.service.stop();
});

it("does not overwrite a broken CLI and validates provider input", async () => {
  const f = fixture();
  f.probe.mockRejectedValue(new Error("Existing CLI cannot run"));
  expect(() => f.service.start("codex; injected")).toThrow();
  f.service.start("claude");
  await expect
    .poll(() => f.service.snapshot().find((x) => x.id === "claude")?.phase)
    .toBe("failed");
  expect(f.install).not.toHaveBeenCalled();
  await f.service.stop();
});

it("cancels running work, allows retry, and prevents starts after shutdown", async () => {
  const f = fixture();
  f.service.start("antigravity");
  await expect.poll(() => f.install.mock.calls.length).toBe(1);
  await f.service.cancel("antigravity");
  expect(
    f.service.snapshot().find((x) => x.id === "antigravity")?.message,
  ).toContain("취소");
  f.service.start("antigravity");
  await expect.poll(() => f.install.mock.calls.length).toBe(2);
  await f.service.stop();
  expect(f.installed.size).toBe(0);
  expect(() => f.service.start("codex")).toThrow();
});
