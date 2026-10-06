import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelMappingStore,
  modelAlias,
} from "../../src/main/proxy/model-mappings";
import { emptyMappings, providers } from "../../src/shared/model-mappings";
import { GatewayError } from "../../src/shared/proxy";

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
  writeText: vi.fn(),
  beginLogin: vi.fn(),
  loginStatus: vi.fn(),
  cancelLogin: vi.fn().mockResolvedValue(undefined),
  accounts: vi.fn().mockResolvedValue([]),
  models: vi.fn().mockResolvedValue([]),
  accountModels: vi.fn().mockResolvedValue([]),
  setModelAliases: vi.fn().mockResolvedValue(undefined),
  phase: "running",
  installed: true,
  start: vi.fn().mockResolvedValue(undefined),
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
      return mocks.installed;
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
    async start(port: number, aliases: unknown) {
      await mocks.start(port, aliases);
      mocks.phase = "running";
    }
    async stop() {
      mocks.phase = "stopped";
    }
  },
}));

import { ModelService } from "../../src/main/models";

describe("gateway startup", () => {
  it("leaves an uninstalled engine stopped without downloading on startup", async () => {
    mocks.installed = false;
    mocks.phase = "stopped";
    mocks.start.mockClear();
    try {
      const service = await ModelService.create("fixture");
      expect((await service.snapshot()).installed).toBe(false);
      expect(mocks.start).not.toHaveBeenCalled();
    } finally {
      mocks.installed = true;
    }
  });
  it("keeps the application available after a startup failure and allows retry", async () => {
    mocks.phase = "stopped";
    mocks.start.mockRejectedValueOnce(
      new GatewayError("runtime", "fixture port occupied"),
    );
    const service = await ModelService.create("fixture");
    expect((await service.snapshot()).loginError).toBe("fixture port occupied");
    await service.start(0);
    expect((await service.snapshot()).loginError).toBeNull();
    expect(mocks.phase).toBe("running");
  });
  it("starts an installed gateway when the application model service opens", async () => {
    mocks.phase = "stopped";
    mocks.start.mockClear();
    await ModelService.create("fixture");
    expect(mocks.start).toHaveBeenCalledWith(8317, {
      codex: [],
      claude: [],
      antigravity: [],
    });
    expect(mocks.phase).toBe("running");
  });
});

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

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

describe("mapped model launches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.phase = "running";
    mocks.setModelAliases.mockResolvedValue(undefined);
    mocks.accounts.mockResolvedValue(
      providers.map((provider) => ({
        name: `${provider}.json`,
        provider,
        email: "",
        status: "active",
        disabled: false,
      })),
    );
    mocks.accountModels.mockImplementation(async (name: string) => {
      const provider = providers.find(
        (candidate) => name === `${candidate}.json`,
      );
      if (!provider) return [];
      return [
        { id: `${provider}-model`, owned_by: "same-author" },
        {
          id: modelAlias(provider, `${provider}-model`),
          owned_by: "same-author",
        },
      ];
    });
  });
  async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "tb-model-service-"));
    directories.push(directory);
    const service = await ModelService.create(directory);
    const settings = emptyMappings();
    settings.rows.push({
      id: randomUUID(),
      name: "Mapped",
      models: {
        codex: "codex-model",
        claude: "claude-model",
        antigravity: "antigravity-model",
      },
      claudeShortcut: "opus",
    });
    return { service, settings, directory };
  }
  it("pins all six CLI routes to aliases belonging to the selected account provider", async () => {
    const { service, settings, directory } = await fixture();
    for (const cli of providers)
      for (const target of providers) {
        if (cli === target) continue;
        settings.routes[cli] = target;
        await service.saveMappings(settings);
        const profile = await service.launchProfile({
          cli,
          model: `${cli}-model`,
        });
        expect(profile.args).toContain(modelAlias(target, `${target}-model`));
        if (cli === "claude") {
          expect(profile.environment["ANTHROPIC_DEFAULT_OPUS_MODEL"]).toBe(
            modelAlias(target, `${target}-model`),
          );
          expect(profile.environment["ANTHROPIC_DEFAULT_SONNET_MODEL"]).toBe(
            modelAlias(target, `${target}-model`),
          );
        }
      }
    expect(
      (await (await ModelService.create(directory)).snapshot()).mappings,
    ).toEqual(settings);
  });
  it("refuses unavailable target providers even when the merged catalog advertises the model", async () => {
    const { service, settings } = await fixture();
    settings.routes.claude = "antigravity";
    await service.saveMappings(settings);
    mocks.models.mockResolvedValue([
      { id: "antigravity-model", owned_by: "google" },
    ]);
    mocks.accountModels.mockResolvedValue([]);
    await expect(
      service.launchProfile({ cli: "claude", model: "opus" }),
    ).rejects.toThrow("Antigravity 계정");
  });
  it("rolls back live aliases if persistence fails", async () => {
    const { service, settings } = await fixture();
    vi.spyOn(ModelMappingStore.prototype, "save").mockRejectedValueOnce(
      new Error("disk full"),
    );
    await expect(service.saveMappings(settings)).rejects.toThrow("이전 설정");
    expect(mocks.setModelAliases).toHaveBeenLastCalledWith({
      codex: [],
      claude: [],
      antigravity: [],
    });
    expect((await service.snapshot()).mappings).toEqual(emptyMappings());
  });
  it("stops routing when a failed live update cannot be rolled back", async () => {
    const { service, settings } = await fixture();
    mocks.setModelAliases
      .mockRejectedValueOnce(new Error("write failed"))
      .mockRejectedValueOnce(new Error("rollback failed"));
    await expect(service.saveMappings(settings)).rejects.toThrow("중지");
    expect(mocks.phase).toBe("stopped");
    expect((await service.snapshot()).mappings).toEqual(emptyMappings());
  });
  it("rejects duplicate source mappings before any runtime mutation", async () => {
    const { service, settings } = await fixture();
    settings.rows.push(...settings.rows);
    expect(() => service.saveMappings(settings)).toThrow("중복");
    expect(mocks.setModelAliases).not.toHaveBeenCalled();
  });
  it("rejects launches whose preview predates a mapping change", async () => {
    const { service, settings } = await fixture();
    const snapshot = await service.snapshot();
    settings.routes.claude = "codex";
    await service.saveMappings(settings);
    await expect(
      service.launchProfile({
        cli: "claude",
        model: "claude-model",
        mappingRevision: snapshot.mappingRevision,
      }),
    ).rejects.toThrow("매핑이 변경");
  });
  it("gives Claude each configured tier its own target model", async () => {
    const { service, settings } = await fixture();
    settings.routes.claude = "codex";
    settings.rows = (["fable", "opus", "sonnet", "haiku"] as const).map(
      (shortcut) => ({
        id: randomUUID(),
        name: shortcut,
        claudeShortcut: shortcut,
        models: {
          claude: `claude-${shortcut}`,
          codex: `gpt-${shortcut}`,
          antigravity: null,
        },
      }),
    );
    mocks.accounts.mockResolvedValue([
      { name: "codex.json", provider: "codex", disabled: false },
    ]);
    mocks.accountModels.mockResolvedValue(
      settings.rows.flatMap((row) => [
        { id: row.models.codex, owned_by: "openai" },
        { id: modelAlias("codex", row.models.codex ?? ""), owned_by: "openai" },
      ]),
    );
    await service.saveMappings(settings);
    const profile = await service.launchProfile({
      cli: "claude",
      model: "fable",
    });
    for (const shortcut of ["fable", "opus", "sonnet", "haiku"])
      expect(
        profile.environment[
          `ANTHROPIC_DEFAULT_${shortcut.toUpperCase()}_MODEL`
        ],
      ).toBe(modelAlias("codex", `gpt-${shortcut}`));
    expect(profile.args).toEqual(["--model", "fable"]);
    expect(profile.environment["ANTHROPIC_MODEL"]).toBe("fable");
  });
  it("rejects a configured Claude shortcut with a missing target", async () => {
    const { service, settings } = await fixture();
    settings.routes.claude = "codex";
    settings.rows.push({
      id: randomUUID(),
      name: "Sonnet",
      claudeShortcut: "sonnet",
      models: { claude: "sonnet", codex: null, antigravity: "other-model" },
    });
    await service.saveMappings(settings);
    await expect(
      service.launchProfile({ cli: "claude", model: "opus" }),
    ).rejects.toThrow("sonnet 단축 이름");
  });
  it("rejects a provider alias that is also advertised by another provider", async () => {
    const { service, settings } = await fixture();
    settings.routes.claude = "codex";
    await service.saveMappings(settings);
    mocks.accountModels.mockResolvedValue([
      { id: "codex-model", owned_by: "openai" },
      { id: modelAlias("codex", "codex-model"), owned_by: "openai" },
    ]);
    await expect(
      service.launchProfile({ cli: "claude", model: "claude-model" }),
    ).rejects.toThrow("충돌");
  });
});
