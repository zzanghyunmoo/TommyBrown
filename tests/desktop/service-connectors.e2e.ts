import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  test,
} from "@playwright/test";
import { oauthServer } from "../fixtures/service-oauth";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

async function routeService(desktop: ElectronApplication, origin: string) {
  await desktop.evaluate(({ shell }, fixtureOrigin) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return realFetch(
        url.origin === "https://mcp.atlassian.com"
          ? fixtureOrigin + url.pathname + url.search
          : input,
        init,
      );
    };
    shell.openExternal = async (url) => {
      await realFetch(`${fixtureOrigin}/opened`, { method: "POST", body: url });
    };
  }, origin);
}

test("service account consent, tool permissions and restart are separate from web apps and custom MCP", async () => {
  test.setTimeout(90000);
  const remote = await oauthServer("https://mcp.atlassian.com");
  const directory = resolve(".local", `desktop-services-${randomUUID()}`);
  const data = resolve(directory, "data");
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: { ...env, TOMMYBROWN_TEST: "1", TOMMYBROWN_DATA_DIR: data },
  };
  const desktop = await electron.launch(options);
  let id = "";
  try {
    await routeService(desktop, remote.origin);
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("tab", { name: "커넥터", exact: true }).click();
    const panel = page.getByRole("tabpanel", { name: "커넥터", exact: true });
    await panel
      .getByRole("button", { name: "커넥터 추가", exact: true })
      .click();
    const card = panel.locator(".connector-card").filter({
      has: page.getByRole("heading", { name: "Atlassian", exact: true }),
    });
    await expect(
      card.getByRole("button", { name: "도구 확인", exact: true }),
    ).toBeDisabled();
    await card.getByRole("button", { name: "계정 연결", exact: true }).click();
    await expect(
      card.getByText("브라우저에서 계정 연결을 승인하세요."),
    ).toBeVisible();
    const abandoned = await remote.approve(remote.opened);
    await card
      .getByRole("button", { name: "로그인 취소", exact: true })
      .click();
    await expect(card.getByText("계정 연결을 취소했습니다.")).toBeVisible();
    await card.getByRole("button", { name: "계정 연결", exact: true }).click();
    await expect(
      card.getByText("브라우저에서 계정 연결을 승인하세요."),
    ).toBeVisible();
    expect((await fetch(abandoned)).status).toBe(400);
    expect((await fetch(await remote.approve(remote.opened))).status).toBe(200);
    await expect(
      card.getByRole("button", { name: "도구 확인", exact: true }),
    ).toBeEnabled();
    const list = await page.evaluate(() => window.connectors.list());
    id = list[0]?.id ?? "";
    expect(list[0]?.authenticated).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(
      /fixture-access|fixture-refresh|fixture-client|oauth/,
    );
    expect(
      (await readFile(resolve(data, "connectors.encrypted"))).includes(
        Buffer.from("fixture-access"),
      ),
    ).toBe(false);
    await expect(
      page.evaluate(
        (connectionId) =>
          window.browser.open("https://example.com", connectionId),
        id,
      ),
    ).rejects.toThrow(/Tool connections/);
    await expect(
      page.evaluate((connectionId) => window.connectors.open(connectionId), id),
    ).rejects.toThrow(/cannot be opened/);
    await card.getByRole("button", { name: "도구 확인", exact: true }).click();
    await expect(
      card.getByRole("checkbox", { name: /^search_work\b/ }),
    ).not.toBeChecked();
    await expect(
      card.getByRole("button", { name: "도구 실행", exact: true }),
    ).toBeDisabled();
    await card.getByRole("checkbox", { name: /^search_work\b/ }).check();
    await card.getByRole("button", { name: "권한 저장", exact: true }).click();
    await card.getByRole("button", { name: "도구 실행", exact: true }).click();
    await expect(
      card.getByRole("region", { name: "도구 실행 결과" }),
    ).toContainText("Synthetic service result");
    expect(remote.calls).toBe(1);
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("화면 테마", { exact: true }).selectOption(theme);
      await card.scrollIntoViewIfNeeded();
      await nativeCapture(
        desktop,
        `test-results/service-connectors-${theme}.png`,
      );
    }
    await panel
      .getByLabel("서비스", { exact: true })
      .selectOption("slack-service");
    await expect(panel.getByLabel("Slack Client Secret")).toHaveAttribute(
      "type",
      "password",
    );
    await expect(
      panel.getByText("http://127.0.0.1:47931/oauth/callback", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    const mcp = page.getByRole("tabpanel", {
      name: "MCP 게이트웨이",
      exact: true,
    });
    await expect(
      mcp.getByRole("heading", { name: "Atlassian", exact: true }),
    ).toHaveCount(0);
    await expect(mcp.getByLabel("MCP 종류").locator("option")).toHaveCount(3);
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
        .getByLabel("Atlassian", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "웹 앱", exact: true }).click();
    const web = page.getByRole("region", { name: "웹 앱 설정" });
    await expect(web.getByLabel("웹 앱 주소")).toBeVisible();
    await expect(
      web.getByRole("heading", { name: "Atlassian", exact: true }),
    ).toHaveCount(0);
    await expect(web.getByLabel("MCP 주소")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await page.getByRole("tab", { name: "커넥터", exact: true }).click();
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    await panel
      .getByRole("heading", { name: "커넥터", exact: true })
      .scrollIntoViewIfNeeded();
    await nativeCapture(desktop, "test-results/service-connectors-minimum.png");
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    await routeService(reopened, remote.origin);
    const page = await desktopWindow(reopened);
    await expect(
      page.getByRole("tab", { name: "커넥터", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const [connection] = await page.evaluate(() => window.connectors.list());
    expect(connection).toMatchObject({
      id,
      authenticated: true,
      allowedTools: ["search_work"],
    });
    const card = page
      .getByRole("tabpanel", { name: "커넥터", exact: true })
      .locator(".connector-card");
    await card.getByRole("button", { name: "도구 확인", exact: true }).click();
    await expect(
      card.getByRole("checkbox", { name: /^search_work\b/ }),
    ).toBeChecked();
  } finally {
    await reopened.close();
    await remote.close();
  }
});
