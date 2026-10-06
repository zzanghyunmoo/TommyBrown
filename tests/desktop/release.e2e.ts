import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("native release opens a terminal, runs Memory and installs its managed engine", async () => {
  test.setTimeout(240_000);
  const directory = resolve(".local", `release-smoke-${randomUUID()}`);
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
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect(page.locator(".xterm-screen")).toBeVisible();
    const session = (await page.evaluate(() => window.terminal.list()))[0];
    if (!session) throw new Error("Native terminal did not start.");
    const command =
      process.platform === "win32"
        ? "Write-Output ('release-' + 'terminal-ready')\r"
        : "printf '%s%s\\n' 'release-' 'terminal-ready'\r";
    await page.evaluate(
      ({ id, command }) => window.terminal.write(id, command),
      { id: session.id, command },
    );
    await expect(page.locator(".xterm-rows")).toContainText(
      "release-terminal-ready",
    );
    const memory = await page.evaluate(async () => {
      const items = await window.connectors.add({
        kind: "memory",
        name: "Release Memory",
        webUrl: null,
        endpoint: null,
        token: null,
      });
      const item = items.find((entry) => entry.kind === "memory");
      if (!item) throw new Error("Memory was not created.");
      const tools = await window.connectors.check(item.id);
      await window.connectors.setTools({
        id: item.id,
        allowedTools: ["create_entities", "read_graph"],
      });
      await window.connectors.call({
        id: item.id,
        name: "create_entities",
        arguments: {
          entities: [
            {
              name: "Release smoke",
              entityType: "test",
              observations: ["synthetic"],
            },
          ],
        },
      });
      return {
        id: item.id,
        tools: tools.tools.map((tool) => tool.name),
        graph: await window.connectors.call({
          id: item.id,
          name: "read_graph",
          arguments: {},
        }),
      };
    });
    expect(memory.tools).toContain("read_graph");
    expect(memory.graph).toContain("Release smoke");
    expect(
      await page.evaluate(() => window.connectors.gateway()),
    ).toMatchObject({ running: true });
    await page.evaluate(() => window.desktop.install());
    await page.evaluate(() => window.desktop.start());
    expect(
      (await page.evaluate(() => window.desktop.snapshot())).gateway.phase,
    ).toBe("running");
    await page.getByLabel("화면 테마", { exact: true }).selectOption("dark");
    await page.screenshot({
      path: `test-results/release-${process.platform}-${process.arch}.png`,
    });
    await page.evaluate(() => window.desktop.stop());
    await page.evaluate((id) => window.terminal.close(id), session.id);
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const restarted = await electron.launch(options);
  try {
    const page = await desktopWindow(restarted);
    await expect(page.getByLabel("화면 테마", { exact: true })).toHaveValue(
      "dark",
    );
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.desktop.snapshot())).gateway.phase,
      )
      .toBe("running");
    const graph = await page.evaluate(async () => {
      const memory = (await window.connectors.list()).find(
        (entry) => entry.kind === "memory",
      );
      if (!memory) throw new Error("Memory registration was lost.");
      return window.connectors.call({
        id: memory.id,
        name: "read_graph",
        arguments: {},
      });
    });
    expect(graph).toContain("Release smoke");
  } finally {
    await restarted.close();
  }
});
