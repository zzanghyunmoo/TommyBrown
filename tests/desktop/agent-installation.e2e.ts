import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { type AgentStatus, agentNames } from "../../src/shared/agents";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("agent installation exposes failure, retry, cancellation and shared terminal status", async () => {
  test.setTimeout(60_000);
  const directory = resolve(".local", `agent-ui-${randomUUID()}`);
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== "ELECTRON_RUN_AS_NODE",
    ),
  );
  const desktop = await electron.launch({
    ...desktopCommand(),
    env: {
      ...env,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_DATA_DIR: resolve(directory, "data"),
    },
  });
  try {
    const page = await desktopWindow(desktop);
    await expect(
      page.evaluate(() =>
        Reflect.apply(window.agents.install, window.agents, [
          "arbitrary-command",
        ]),
      ),
    ).rejects.toThrow();
    const states: AgentStatus[] = ["codex", "claude", "antigravity"].map(
      (id) => ({
        id:
          id === "codex" ? "codex" : id === "claude" ? "claude" : "antigravity",
        phase: "missing",
        path: null,
        version: null,
        message: "설치되지 않음",
        log: "",
      }),
    );
    await desktop.evaluate(({ ipcMain }, initial) => {
      const attempts = new Map<string, number>();
      const state = initial;
      for (const channel of [
        "agents:snapshot",
        "agents:refresh",
        "agents:install",
        "agents:cancel",
      ])
        ipcMain.removeHandler(channel);
      ipcMain.handle("agents:snapshot", () => state);
      ipcMain.handle("agents:refresh", () => state);
      ipcMain.handle("agents:install", (_event, id: string) => {
        const index = state.findIndex((item) => item.id === id);
        const previous = state[index];
        if (!previous) throw new Error("Invalid ID");
        const count = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, count);
        state[index] = {
          ...previous,
          phase: "installing",
          message: "공식 설치 프로그램 실행 중…",
          log: "Downloading official CLI...",
        };
        setTimeout(
          () => {
            if (state[index]?.phase !== "installing") return;
            const failed = id === "codex" && count === 1;
            state[index] = {
              ...previous,
              phase: failed ? "failed" : "installed",
              message: failed
                ? "다운로드 실패: 네트워크 연결을 확인하세요."
                : "설치됨",
              version: failed ? null : "CLI fixture 1.0.0",
              path: failed ? null : "CLI fixture",
              log: failed
                ? "HTTP 503: test download failure"
                : "Verified version",
            };
          },
          id === "claude" ? 5000 : 1500,
        );
        return state;
      });
      ipcMain.handle("agents:cancel", (_event, id: string) => {
        const index = state.findIndex((item) => item.id === id);
        const previous = state[index];
        if (previous)
          state[index] = {
            ...previous,
            phase: "failed",
            message: "설치를 취소했습니다.",
          };
        return state;
      });
    }, states);
    await page.getByRole("tab", { name: "일반·색상", exact: true }).click();
    const general = page.getByRole("tabpanel", {
      name: "일반·색상",
      exact: true,
    });
    for (const name of Object.values(agentNames))
      await expect(
        general.getByRole("button", { name: `${name} 설치`, exact: true }),
      ).toBeVisible();
    await general
      .getByRole("heading", { name: "코딩 에이전트", exact: true })
      .scrollIntoViewIfNeeded();
    await general
      .getByRole("region", { name: "Antigravity 설치", exact: true })
      .scrollIntoViewIfNeeded();
    await nativeCapture(desktop, "test-results/agent-installation-missing.png");
    const codex = general.getByRole("region", {
      name: "Codex 설치",
      exact: true,
    });
    await codex
      .getByRole("button", { name: "Codex 설치", exact: true })
      .click();
    await expect(
      codex.getByRole("button", { name: "설치 취소", exact: true }),
    ).toBeVisible();
    await expect(codex.getByRole("alert")).toContainText("다운로드 실패");
    await expect(
      codex.getByText("HTTP 503: test download failure", { exact: true }),
    ).toBeVisible();
    await nativeCapture(desktop, "test-results/agent-installation-failed.png");
    await codex.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(
      codex.getByText("CLI fixture 1.0.0", { exact: true }),
    ).toBeVisible();
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByLabel("CLI", { exact: true }).selectOption("antigravity");
    await expect(
      page.getByRole("button", { name: "새 세션", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Antigravity 설치", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await expect(
      general
        .getByRole("region", { name: "Antigravity 설치", exact: true })
        .getByText("CLI fixture 1.0.0", { exact: true }),
    ).toBeVisible();
    const claude = general.getByRole("region", {
      name: "Claude Code 설치",
      exact: true,
    });
    await claude
      .getByRole("button", { name: "Claude Code 설치", exact: true })
      .click();
    await claude
      .getByRole("button", { name: "설치 취소", exact: true })
      .click();
    await expect(claude.getByRole("alert")).toContainText("취소");
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "project", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "새 세션", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await page
      .getByLabel("일반 설정 테마", { exact: true })
      .selectOption("dark");
    await general
      .getByRole("heading", { name: "코딩 에이전트", exact: true })
      .scrollIntoViewIfNeeded();
    await general
      .getByRole("region", { name: "Antigravity 설치", exact: true })
      .scrollIntoViewIfNeeded();
    await nativeCapture(desktop, "test-results/agent-installation-dark.png");
  } finally {
    await desktop.close();
  }
});
