import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("connector screens use separate persistent sessions and disconnect clears local credentials", async () => {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(
      "<title>Connector fixture</title><h1>Connected web screen</h1>",
    );
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No web fixture port");
  const url = `http://127.0.0.1:${address.port}/`;
  const directory = resolve(".local", `desktop-connectors-${randomUUID()}`);
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
    await page.getByRole("button", { name: "커넥터", exact: true }).click();
    const panel = page.getByRole("region", { name: "커넥터 설정" });
    await panel.getByLabel("서비스", { exact: true }).selectOption("github");
    await panel.getByLabel("연결 이름", { exact: true }).fill("Fixture source");
    await panel.getByLabel("웹 앱 주소", { exact: true }).fill(url);
    await panel
      .getByText("MCP 데이터·도구 연결 (선택)", { exact: true })
      .click();
    await panel
      .getByLabel("액세스 토큰", { exact: true })
      .fill("native-secret-fixture");
    await panel
      .getByRole("button", { name: "커넥터 추가", exact: true })
      .click();
    await expect(
      panel.getByRole("heading", { name: "Fixture source" }),
    ).toBeVisible();
    expect(
      await panel.getByLabel("액세스 토큰", { exact: true }).inputValue(),
    ).toBe("");
    const list = await page.evaluate(() => window.connectors.list());
    connectorId = list[0]?.id ?? "";
    expect(JSON.stringify(list)).not.toContain("native-secret-fixture");
    expect(
      (await readFile(resolve(data, "connectors.encrypted"))).includes(
        Buffer.from("native-secret-fixture"),
      ),
    ).toBe(false);
    await page.screenshot({ path: "test-results/connector-registry.png" });
    await panel
      .getByRole("heading", { name: "Fixture source" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/connector-configured.png" });
    await panel
      .getByRole("button", { name: "웹 화면 열기", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "내장 브라우저" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        desktop
          .context()
          .pages()
          .map((candidate) => candidate.url()),
      )
      .toContain(url);
    const isolated = await desktop.evaluate(
      async ({ session }, { id, url }) => {
        const partition = session.fromPartition(
          `persist:tommybrown-connector-${id}`,
        );
        await partition.cookies.set({
          url,
          name: "fixture-login",
          value: "kept",
          expirationDate: Date.now() / 1000 + 3600,
        });
        await partition.cookies.flushStore();
        return (
          await session
            .fromPartition("persist:tommybrown-browser")
            .cookies.get({ url })
        ).length;
      },
      { id: connectorId, url },
    );
    expect(isolated).toBe(0);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(
      page.getByRole("region", { name: "내장 브라우저" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.browser
            .snapshot()
            .then((state) => state.tabs.map((tab) => tab.connectorId)),
        ),
      )
      .toEqual([connectorId]);
    await page.getByRole("button", { name: "커넥터", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Fixture source" }),
    ).toBeVisible();
    expect(
      await reopened.evaluate(
        async ({ session }, id) =>
          (
            await session
              .fromPartition(`persist:tommybrown-connector-${id}`)
              .cookies.get({ name: "fixture-login" })
          ).length,
        connectorId,
      ),
    ).toBe(1);
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "연결 해제", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Fixture source" }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => window.connectors.list())).toEqual([]);
    expect(
      await reopened.evaluate(
        async ({ session }, id) =>
          (
            await session
              .fromPartition(`persist:tommybrown-connector-${id}`)
              .cookies.get({})
          ).length,
        connectorId,
      ),
    ).toBe(0);
  } finally {
    await reopened.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
