import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  writeText: vi.fn(),
  beginLogin: vi.fn(),
  loginStatus: vi.fn(),
  cancelLogin: vi.fn().mockResolvedValue(undefined),
  accounts: vi.fn().mockResolvedValue([]),
  models: vi.fn().mockResolvedValue([]),
  phase: "running",
}));

vi.mock("electron", () => ({
  shell: { openExternal: mocks.openExternal },
  clipboard: { writeText: mocks.writeText },
}));
vi.mock("../../src/main/secrets", () => ({
  loadGatewayKeys: async () => ({
    client: "test-client",
    management: "test-management",
  }),
}));
vi.mock("../../src/main/proxy/installer", () => ({
  PROXY_VERSION: "test-version",
  ProxyInstaller: class {
    executable = "fixture.exe";
    async isInstalled() {
      return true;
    }
  },
}));
vi.mock("../../src/main/proxy/runtime", () => ({
  ProxyRuntime: class {
    get status() {
      return { phase: mocks.phase, port: 8317, pid: 1 };
    }
    client() {
      return mocks;
    }
    async stop() {
      mocks.phase = "stopped";
    }
  },
}));

import { ModelService } from "../../src/main/models";

describe("model login lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.phase = "running";
    mocks.beginLogin.mockResolvedValue({
      url: "https://claude.ai/oauth/authorize",
      state: "test-state",
    });
    mocks.loginStatus.mockResolvedValue({ status: "wait" });
  });

  it("restores the pending login in snapshots and prevents duplicate sessions", async () => {
    const service = await ModelService.create("fixture");
    await service.login("claude");
    const first = await service.snapshot();
    const refreshed = await service.snapshot();
    expect(first.login?.provider).toBe("claude");
    expect(refreshed.login).toEqual(first.login);
    await expect(service.login("codex")).rejects.toThrow("Finish or cancel");
    expect(mocks.beginLogin).toHaveBeenCalledTimes(1);
  });

  it("keeps a session recoverable after a transient polling failure", async () => {
    const service = await ModelService.create("fixture");
    await service.login("claude");
    mocks.loginStatus.mockRejectedValueOnce(
      new Error("temporary network failure"),
    );
    await expect(service.snapshot()).rejects.toThrow("temporary");
    expect((await service.snapshot()).login?.state).toBe("test-state");
    await service.cancelLogin("test-state");
    expect((await service.snapshot()).login).toBeNull();
    expect(mocks.cancelLogin).toHaveBeenCalledWith("test-state");
  });

  it("expires pending sessions and reports a retryable error", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const service = await ModelService.create("fixture");
      await service.login("claude");
      now.mockReturnValue(302000);
      const snapshot = await service.snapshot();
      expect(snapshot.login).toBeNull();
      expect(snapshot.loginError).toContain("대기 시간");
      expect(mocks.cancelLogin).toHaveBeenCalledWith("test-state");
    } finally {
      now.mockRestore();
    }
  });

  it("drops completed sessions and refreshes the account list", async () => {
    const service = await ModelService.create("fixture");
    await service.login("claude");
    mocks.loginStatus.mockResolvedValueOnce({ status: "ok" });
    const snapshot = await service.snapshot();
    expect(snapshot.login).toBeNull();
    expect(snapshot.loginError).toBeNull();
    expect(mocks.accounts).toHaveBeenCalled();
  });

  it("recovers when the gateway exits during consent", async () => {
    const service = await ModelService.create("fixture");
    await service.login("claude");
    mocks.phase = "error";
    const snapshot = await service.snapshot();
    expect(snapshot.login).toBeNull();
    expect(snapshot.loginError).toContain("중지");
  });
});
