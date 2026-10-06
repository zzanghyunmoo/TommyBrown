import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("settings retain drafts and sessions, share MCP policies and restore appearance", async () => {
  test.setTimeout(90_000);
  const directory = resolve(".local", `desktop-settings-${randomUUID()}`);
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: {
      ...env,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_DATA_DIR: resolve(directory, "data"),
    },
  };
  const desktop = await electron.launch(options);
  try {
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const settings = page.getByRole("region", { name: "설정", exact: true });
    const proxy = settings.getByRole("tabpanel", {
      name: "프록시·모델",
      exact: true,
    });
    const mcp = settings.getByRole("tabpanel", {
      name: "MCP 게이트웨이",
      exact: true,
    });
    const general = settings.getByRole("tabpanel", {
      name: "일반·색상",
      exact: true,
    });
    const tabs = settings.getByRole("tablist", { name: "설정 분류" });
    await expect(
      proxy.getByRole("heading", { name: "프록시·모델", exact: true }),
    ).toBeVisible();
    await page.getByLabel("화면 테마", { exact: true }).selectOption("light");
    await nativeCapture(desktop, "test-results/settings-proxy-light.png");
    await tabs.getByRole("tab", { name: "프록시·모델", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(
      tabs.getByRole("tab", { name: "MCP 게이트웨이", exact: true }),
    ).toBeFocused();
    await expect(
      mcp.getByText("MCP 게이트웨이 · 실행 중", { exact: true }),
    ).toBeVisible();
    await mcp.getByLabel("MCP 종류", { exact: true }).selectOption("memory");
    await mcp.getByLabel("서버 이름", { exact: true }).fill("Settings Memory");
    await tabs.getByRole("tab", { name: "일반·색상", exact: true }).click();
    await general
      .getByLabel("일반 설정 테마", { exact: true })
      .selectOption("dark");
    await expect(page.getByLabel("화면 테마", { exact: true })).toHaveValue(
      "dark",
    );
    await general.getByLabel("사이드바 표시", { exact: true }).uncheck();
    await expect(
      page.getByRole("complementary", { name: "TommyBrown 탐색" }),
    ).toBeHidden();
    await nativeCapture(desktop, "test-results/settings-general-dark.png");
    await page
      .getByRole("button", { name: "사이드바 표시 전환", exact: true })
      .click();
    await expect(
      general.getByLabel("사이드바 표시", { exact: true }),
    ).toBeChecked();
    await tabs
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    await expect(mcp.getByLabel("서버 이름", { exact: true })).toHaveValue(
      "Settings Memory",
    );
    await mcp
      .getByRole("button", { name: "MCP 서버 추가", exact: true })
      .click();
    const card = mcp.locator(".connector-card");
    await card.getByRole("button", { name: "도구 확인", exact: true }).click();
    await card.getByRole("button", { name: "전체 차단", exact: true }).click();
    await card.getByRole("checkbox", { name: /^read_graph\b/ }).check();
    await card.getByRole("button", { name: "권한 저장", exact: true }).click();
    await expect(card.getByRole("status")).toHaveText("저장된 권한 적용 중");
    await nativeCapture(desktop, "test-results/settings-mcp-dark.png");
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.locator(".terminal-connectors summary").click();
    await expect(
      page
        .locator(".terminal-connectors")
        .getByLabel("Settings Memory", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await page.locator(".xterm-screen").click();
    await page.keyboard.type("Write-Output ('settings-' + 'pty-retained')");
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm-rows")).toContainText(
      "settings-pty-retained",
    );
    const sessions = await page.evaluate(() => window.terminal.list());
    await page.getByRole("tab", { name: "웹 앱", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "웹 앱 설정" })
        .getByRole("heading", { name: "Settings Memory" }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await card.getByRole("checkbox", { name: /^search_nodes\b/ }).check();
    await card.getByRole("button", { name: "권한 저장", exact: true }).click();
    await expect(card.getByRole("status")).toHaveText("저장된 권한 적용 중");
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "project", exact: true })
      .click();
    await page.getByRole("tab", { name: "터미널", exact: true }).click();
    await expect(page.locator(".xterm-rows")).toContainText(
      "settings-pty-retained",
    );
    expect(await page.evaluate(() => window.terminal.list())).toEqual(sessions);
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await tabs.getByRole("tab", { name: "일반·색상", exact: true }).click();
    await general.getByLabel("사이드바 표시", { exact: true }).uncheck();
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    for (const theme of ["light", "dark"]) {
      await general
        .getByLabel("일반 설정 테마", { exact: true })
        .selectOption(theme);
      await expect(page.locator(".statusbar")).toBeInViewport();
      await expect(
        general.getByLabel("사이드바 표시", { exact: true }),
      ).toBeInViewport();
      await nativeCapture(
        desktop,
        `test-results/settings-general-${theme}-minimum.png`,
      );
    }
    await tabs
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    await page.getByLabel("화면 테마", { exact: true }).selectOption("light");
    await mcp
      .getByRole("heading", { name: "MCP 게이트웨이", exact: true })
      .scrollIntoViewIfNeeded();
    await nativeCapture(desktop, "test-results/settings-mcp-light-minimum.png");
    await page.getByLabel("화면 테마", { exact: true }).selectOption("dark");
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(
      page.getByRole("tab", { name: "MCP 게이트웨이", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("화면 테마", { exact: true })).toHaveValue(
      "dark",
    );
    await expect(page.locator(".sidebar")).toBeHidden();
    const mcp = page.getByRole("tabpanel", {
      name: "MCP 게이트웨이",
      exact: true,
    });
    await expect(
      mcp.getByRole("heading", { name: "Settings Memory", exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.connectors.list()))[0]?.allowedTools,
    ).toEqual(["read_graph", "search_nodes"]);
    await page.getByRole("tab", { name: "일반·색상", exact: true }).click();
    await expect(
      page.getByLabel("사이드바 표시", { exact: true }),
    ).not.toBeChecked();
  } finally {
    await reopened.close();
  }
});
