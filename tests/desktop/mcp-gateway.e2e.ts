import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("shared gateway starts with the desktop, configures all shell CLIs, and revokes disconnected terminals", async () => {
  const directory = resolve(".local", `desktop-mcp-${randomUUID()}`);
  const project = resolve(directory, "project");
  const data = resolve(directory, "data");
  await mkdir(project, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: { ...env, TOMMYBROWN_TEST: "1", TOMMYBROWN_DATA_DIR: data },
  };
  let connectorId = "";
  const desktop = await electron.launch(options);
  try {
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    const page = await desktopWindow(desktop);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "MCP 게이트웨이" }),
    ).toHaveText("MCP 게이트웨이 · 실행 중");
    await page.getByLabel("MCP 종류", { exact: true }).selectOption("mcp");
    await page.getByLabel("서버 이름", { exact: true }).fill("Shared fixture");
    await page
      .getByLabel("MCP 주소", { exact: true })
      .fill("http://127.0.0.1:9/mcp");
    await page
      .getByLabel("Bearer 액세스 토큰", { exact: true })
      .fill("desktop-upstream-fixture");
    await page
      .getByRole("button", { name: "MCP 서버 추가", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shared fixture" }),
    ).toBeVisible();
    connectorId =
      (await page.evaluate(() => window.connectors.list()))[0]?.id ?? "";
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "project", exact: true })
      .click();
    await page.getByRole("tab", { name: "터미널", exact: true }).click();
    await page.locator(".terminal-connectors summary").click();
    await page.getByLabel("Shared fixture", { exact: true }).check();
    for (const cli of ["claude", "codex", "antigravity", "powershell"]) {
      await page.getByLabel("CLI", { exact: true }).selectOption(cli);
      await expect(
        page.getByLabel("Shared fixture", { exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByLabel("Shared fixture", { exact: true }),
      ).toBeChecked();
    }
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.terminal.list().then((sessions) => sessions.length),
        ),
      )
      .toBe(1);
    const [session] = await page.evaluate(() => window.terminal.list());
    if (!session) throw new Error("No terminal");
    expect(session.connectors).toEqual([connectorId]);
    await page.evaluate(
      (id) =>
        window.terminal.write(
          id,
          "Write-Output ('functions:' + (Get-Command codex).CommandType + ':' + (Get-Command claude).CommandType + ':' + (Get-Command agy).CommandType); codex mcp get tommybrown --json\r",
        ),
      session.id,
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) => window.terminal.attach(id).then((buffer) => buffer.data),
            session.id,
          ),
        { timeout: 15000 },
      )
      .toContain("functions:Function:Function:Function");
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) => window.terminal.attach(id).then((buffer) => buffer.data),
            session.id,
          ),
        { timeout: 15000 },
      )
      .toContain("TOMMYBROWN_MCP_TOKEN");
    const folders = await readdir(resolve(data, "mcp-sessions"));
    expect(folders).toHaveLength(1);
    const config = await readFile(
      resolve(
        data,
        "mcp-sessions",
        folders[0] ?? "",
        ".agents/plugins/tommybrown/mcp_config.json",
      ),
      "utf8",
    );
    expect(config).not.toContain("desktop-upstream-fixture");
    expect(config).not.toContain(":9/mcp");
    const parsed = JSON.parse(config);
    const endpoint = parsed.mcpServers.tommybrown.url;
    const authorization = parsed.mcpServers.tommybrown.headers.Authorization;
    expect(
      (await fetch(endpoint, { headers: { Authorization: authorization } }))
        .status,
    ).toBe(405);
    await nativeCapture(desktop, "test-results/mcp-gateway-native.png");
    await page.evaluate((id) => window.connectors.disconnect(id), connectorId);
    expect(await page.evaluate(() => window.terminal.list())).toEqual([]);
    expect(
      (await fetch(endpoint, { headers: { Authorization: authorization } }))
        .status,
    ).toBe(401);
    expect(await readdir(resolve(data, "mcp-sessions"))).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    expect(await page.evaluate(() => window.connectors.gateway())).toEqual({
      running: true,
      sessions: 0,
    });
    expect(await page.evaluate(() => window.connectors.list())).toEqual([]);
  } finally {
    await reopened.close();
  }
});
