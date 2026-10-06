import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { _electron as electron, expect, test } from "@playwright/test";
import { exactTransport } from "../../src/main/connectors/transport";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("Memory permissions control existing gateway sessions and persist with remembered data", async () => {
  const directory = resolve(".local", `desktop-mcp-policy-${randomUUID()}`);
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
  const desktop = await electron.launch(options);
  const client = new Client({ name: "desktop-policy-test", version: "1" });
  let connectorId = "";
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
    await page.getByLabel("MCP 종류", { exact: true }).selectOption("memory");
    await expect(
      page.getByText("별도 설치나 로그인", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "MCP 서버 추가", exact: true })
      .click();
    const card = page.locator(".connector-card").filter({
      has: page.getByRole("heading", { name: "Memory", exact: true }),
    });
    await card.getByRole("button", { name: "도구 확인", exact: true }).click();
    await expect(
      card.getByRole("group", { name: "에이전트 도구 권한" }),
    ).toBeVisible();
    await card
      .getByRole("combobox", { name: "도구", exact: true })
      .selectOption("create_entities");
    await card.getByLabel("인수 (JSON)").fill(
      JSON.stringify({
        entities: [
          {
            name: "Desktop synthetic memory",
            entityType: "test",
            observations: ["persists across restarts"],
          },
        ],
      }),
    );
    await card.getByRole("button", { name: "도구 실행", exact: true }).click();
    await expect(
      card.getByRole("region", { name: "도구 실행 결과" }),
    ).toContainText("Desktop synthetic memory");
    connectorId =
      (await page.evaluate(() => window.connectors.list()))[0]?.id ?? "";
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "project", exact: true })
      .click();
    await page.getByRole("tab", { name: "터미널", exact: true }).click();
    await page.locator(".terminal-connectors summary").click();
    await page.getByLabel("Memory", { exact: true }).check();
    await page.getByLabel("CLI", { exact: true }).selectOption("powershell");
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.terminal.list().then((items) => items.length),
        ),
      )
      .toBe(1);
    const [folder] = await readdir(resolve(data, "mcp-sessions"));
    if (!folder) throw new Error("Missing gateway profile");
    const config = JSON.parse(
      await readFile(
        resolve(
          data,
          "mcp-sessions",
          folder,
          ".agents/plugins/tommybrown/mcp_config.json",
        ),
        "utf8",
      ),
    );
    await client.connect(
      exactTransport(
        new StreamableHTTPClientTransport(
          new URL(config.mcpServers.tommybrown.url),
          {
            requestInit: {
              headers: {
                Authorization:
                  config.mcpServers.tommybrown.headers.Authorization,
              },
            },
          },
        ),
      ),
    );
    const before = await client.listTools();
    const forbidden = before.tools.find((tool) =>
      tool.name.startsWith("delete_entities_"),
    );
    if (!forbidden) throw new Error("Missing delete tool");
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    await card.getByRole("button", { name: "전체 차단", exact: true }).click();
    await card.getByRole("checkbox", { name: /^read_graph\b/ }).check();
    await card.getByRole("button", { name: "권한 저장", exact: true }).click();
    await expect(card.getByRole("status")).toHaveText("저장된 권한 적용 중");
    await expect(
      card.getByRole("button", { name: "도구 실행", exact: true }),
    ).toBeDisabled();
    await expect(
      client.callTool({
        name: forbidden.name,
        arguments: { entityNames: ["Desktop synthetic memory"] },
      }),
    ).rejects.toThrow(/blocked/);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      expect.stringMatching(/^read_graph_/),
    ]);
    await card
      .getByRole("combobox", { name: "도구", exact: true })
      .selectOption("read_graph");
    await card.getByLabel("인수 (JSON)").fill("{}");
    await card.getByRole("button", { name: "도구 실행", exact: true }).click();
    await expect(
      card.getByRole("region", { name: "도구 실행 결과" }),
    ).toContainText("Desktop synthetic memory");
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("화면 테마").selectOption(theme);
      await card
        .getByRole("group", { name: "에이전트 도구 권한" })
        .scrollIntoViewIfNeeded();
      await nativeCapture(desktop, `test-results/mcp-permissions-${theme}.png`);
    }
    await page.getByLabel("MCP 종류", { exact: true }).selectOption("context7");
    await expect(page.getByLabel("MCP 주소", { exact: true })).toHaveValue(
      "https://mcp.context7.com/mcp",
    );
  } finally {
    await client.close();
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    const connectors = await page.evaluate(() => window.connectors.list());
    expect(
      connectors.find((item) => item.id === connectorId)?.allowedTools,
    ).toEqual(["read_graph"]);
    expect(
      await page.evaluate(
        (id) =>
          window.connectors.call({ id, name: "read_graph", arguments: {} }),
        connectorId,
      ),
    ).toContain("Desktop synthetic memory");
    await page
      .getByRole("navigation", { name: "열린 화면" })
      .getByRole("button", { name: "설정", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "MCP 게이트웨이", exact: true })
      .click();
    await page.getByRole("button", { name: "도구 확인", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /^read_graph\b/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /^delete_entities\b/ }),
    ).not.toBeChecked();
  } finally {
    await reopened.close();
  }
});
