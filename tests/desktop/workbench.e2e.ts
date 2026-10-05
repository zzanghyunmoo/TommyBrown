import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

async function nativeKey(
  desktop: ElectronApplication,
  page: Page,
  key: string,
  modifiers: ("control" | "shift")[] = [],
  phase: "press" | "down" | "up" = "press",
) {
  await desktop.evaluate(
    ({ webContents, BrowserWindow }, input) => {
      const contents =
        webContents
          .getAllWebContents()
          .find((item) => item.getURL() === input.url) ??
        (input.phase === "up"
          ? BrowserWindow.getAllWindows()[0]?.webContents
          : undefined);
      if (!contents) throw new Error("Keyboard target disappeared");
      contents.focus();
      if (input.phase !== "up")
        contents.sendInputEvent({
          type: "keyDown",
          keyCode: input.key,
          modifiers: input.modifiers,
        });
      if (input.phase !== "down")
        contents.sendInputEvent({
          type: "keyUp",
          keyCode: input.key,
          modifiers: input.modifiers,
        });
    },
    { url: page.url(), key, modifiers, phase },
  );
}
async function prefix(desktop: ElectronApplication, page: Page, key: string) {
  // CDP keyboard dispatch bypasses Electron's native before-input-event hook.
  await nativeKey(desktop, page, "B", ["control"]);
  const shifted = key === "?" || /^[A-Z]$/.test(key);
  if (shifted) await nativeKey(desktop, page, "Shift", ["shift"], "down");
  await nativeKey(desktop, page, key.toUpperCase(), shifted ? ["shift"] : []);
  if (shifted) await nativeKey(desktop, page, "Shift", [], "up");
}

test("terminal, browser, and app stay live together through Herdr pane commands", async () => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    const application = request.url?.startsWith("/app");
    response.end(`<html><head><title>${application ? "Task app" : "Reference notes"}</title></head>
      <body style="font:14px system-ui;background:${application ? "#f4f0e7" : "#fdfcf9"};color:#292825;padding:20px;margin:0">
      <small>${application ? "LOCAL DEVELOPMENT" : "REFERENCE"}</small><h1 style="font-size:22px">${application ? "Task app" : "Reference notes"}</h1>
      <p>${application ? "Preview changes beside your terminal." : "Keep documentation open while your agent works."}</p>
      <label>Note <input aria-label="Note" /></label><button onclick="this.textContent='Updated'">Try app</button>
      <p><a href="/next">Next page</a> <a href="/popup" target="_blank">Open reference tab</a></p></body></html>`);
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  const origin = `http://127.0.0.1:${address.port}`;
  const directory = resolve(".local", `workbench-${randomUUID()}`);
  const project = resolve(directory, "project");
  const other = resolve(directory, "other");
  await mkdir(project, { recursive: true });
  await mkdir(other, { recursive: true });
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
  let desktop = await electron.launch(options);
  try {
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    const page = await desktopWindow(desktop);
    await desktop.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.show();
      window?.focus();
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    const terminal = page.locator('[data-pane="terminal"]');
    const browser = page.locator('[data-pane="browser"]');
    const app = page.locator('[data-pane="app"]');
    await terminal
      .getByRole("button", { name: "새 세션", exact: true })
      .click();
    await terminal.locator(".xterm-screen").click();
    await page.keyboard.type("Write-Output ('workbench-' + 'alive')");
    await page.keyboard.press("Enter");
    await expect(terminal.locator(".xterm-rows")).toContainText(
      "workbench-alive",
    );
    await browser
      .getByRole("textbox", { name: "웹 주소", exact: true })
      .fill(`${origin}/reference`);
    await browser.getByRole("button", { name: "이동", exact: true }).click();
    await app
      .getByRole("textbox", { name: "앱 주소", exact: true })
      .fill(`${origin}/app`);
    await app.getByRole("button", { name: "이동", exact: true }).click();
    await expect
      .poll(() =>
        desktop
          .context()
          .pages()
          .map((item) => item.url()),
      )
      .toContain(`${origin}/app`);
    const web = desktop
      .context()
      .pages()
      .find((item) => item.url() === `${origin}/reference`);
    const preview = desktop
      .context()
      .pages()
      .find((item) => item.url() === `${origin}/app`);
    if (!web || !preview) throw new Error("Simultaneous pages missing");
    await expect(
      web.getByRole("heading", { name: "Reference notes" }),
    ).toBeVisible();
    await expect(
      preview.getByRole("heading", { name: "Task app" }),
    ).toBeVisible();
    await preview.getByRole("button", { name: "Try app" }).click();
    await expect(
      preview.getByRole("button", { name: "Updated" }),
    ).toBeVisible();
    await web.getByRole("textbox", { name: "Note" }).fill("retained reference");
    await preview.getByRole("textbox", { name: "Note" }).fill("retained app");
    const visibleViews = () =>
      desktop.evaluate(
        ({ BrowserWindow, WebContentsView }) =>
          BrowserWindow.getAllWindows()[0]?.contentView.children.filter(
            (view) => view instanceof WebContentsView && view.getVisible(),
          ).length,
      );
    await expect.poll(visibleViews).toBe(2);
    expect(
      await preview.evaluate(
        () =>
          "workbench" in window || "terminal" in window || "require" in window,
      ),
    ).toBe(false);
    await page.screenshot({ path: "test-results/workbench-controls.png" });
    await nativeCapture(desktop, "test-results/workbench-native.png");

    await web.getByRole("textbox", { name: "Note" }).click();
    await prefix(desktop, web, "h");
    await expect(terminal).toHaveAttribute("data-focused", "true");
    await expect(terminal.locator("textarea")).toBeFocused();
    await prefix(desktop, page, "z");
    await expect(browser).toBeHidden();
    await expect(app).toBeHidden();
    await expect.poll(visibleViews).toBe(0);
    await prefix(desktop, page, "z");
    await expect.poll(visibleViews).toBe(2);
    await prefix(desktop, page, "-");
    await expect(page.locator('[data-kind="terminal"]')).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.terminal.list().then((items) => items.length),
        ),
      )
      .toBe(2);
    await expect(terminal.locator(".xterm-rows")).toContainText(
      "workbench-alive",
    );
    const second = page.locator('[data-kind="terminal"]').nth(1);
    await expect(second.locator("textarea")).toBeFocused();
    await page.keyboard.type("Write-Output ('second-' + 'session')");
    await page.keyboard.press("Enter");
    await expect(second.locator(".xterm-rows")).toContainText("second-session");
    await prefix(desktop, page, "r");
    await nativeKey(desktop, page, "L");
    await nativeKey(desktop, page, "Escape");
    await expect(
      page.getByRole("separator", { name: "좌우 패널 크기" }).first(),
    ).toHaveAttribute("aria-valuenow", "53");
    await prefix(desktop, page, "?");
    await expect(
      page.getByRole("dialog", { name: "Herdr 단축키" }),
    ).toBeVisible();
    await expect.poll(visibleViews).toBe(0);
    await nativeKey(desktop, page, "Escape");
    await expect.poll(visibleViews).toBe(2);
    const appState = await page.evaluate(() => window.browser.snapshot("app"));
    await web.getByRole("link", { name: "Open reference tab" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.browser.snapshot().then((state) => state.tabs.length),
        ),
      )
      .toBe(2);
    await expect.poll(visibleViews).toBe(2);
    expect(await page.evaluate(() => window.browser.snapshot("app"))).toEqual(
      appState,
    );
    const popup = desktop
      .context()
      .pages()
      .find((item) => item.url() === `${origin}/popup`);
    if (!popup) throw new Error("Grouped popup did not open");
    await prefix(desktop, popup, "p");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.browser.snapshot().then((state) => state.selected),
        ),
      )
      .toBe((await page.evaluate(() => window.browser.snapshot())).tabs[0]?.id);
    await prefix(desktop, web, "n");
    await prefix(desktop, popup, "X");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.browser.snapshot().then((state) => state.tabs.length),
        ),
      )
      .toBe(1);
    await expect(web.getByRole("textbox", { name: "Note" })).toHaveValue(
      "retained reference",
    );
    await expect(preview.getByRole("textbox", { name: "Note" })).toHaveValue(
      "retained app",
    );
    await prefix(desktop, page, "b");
    await expect(
      page.getByRole("complementary", { name: "TommyBrown 탐색" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "사이드바 표시 전환" }).click();
    await page
      .getByRole("button", { name: "모델 연결", exact: true })
      .first()
      .click();
    await expect.poll(visibleViews).toBe(0);
    await page.locator(".space-row").filter({ hasText: "project" }).click();
    await expect.poll(visibleViews).toBe(2);
    const originalSessions = await page.evaluate(() => window.terminal.list());
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, other);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await expect(page.locator('[data-kind="terminal"]')).toHaveCount(1);
    await terminal.getByRole("button", { name: "터미널", exact: true }).click();
    await prefix(desktop, page, "-");
    await expect(page.locator('[data-kind="terminal"]')).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.terminal.list().then((items) => items.length),
        ),
      )
      .toBe(3);
    page.once("dialog", (dialog) => dialog.accept());
    await prefix(desktop, page, "x");
    await expect(page.locator('[data-kind="terminal"]')).toHaveCount(1);
    expect(
      (await page.evaluate(() => window.terminal.list())).map(
        (item) => item.id,
      ),
    ).toEqual(originalSessions.map((item) => item.id));
    await prefix(desktop, page, "-");
    await expect(page.locator('[data-kind="terminal"]')).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.terminal.list().then((items) => items.length),
        ),
      )
      .toBe(3);
    await prefix(desktop, page, "z");
    await page.locator(".space-row").filter({ hasText: "project" }).click();
    await expect(terminal).toBeVisible();
    await expect(second).toBeVisible();
    await expect.poll(visibleViews).toBe(2);
    await expect(terminal.locator(".xterm-rows")).toContainText(
      "workbench-alive",
    );
    expect((await page.evaluate(() => window.terminal.list())).length).toBe(3);
    const split = page
      .getByRole("separator", { name: "좌우 패널 크기" })
      .first();
    const bounds = await split.boundingBox();
    if (!bounds) throw new Error("Missing splitter hit area");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 4,
    );
    await page.mouse.down();
    await expect.poll(visibleViews).toBe(0);
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 30,
      bounds.y + bounds.height / 4,
    );
    await page.mouse.up();
    await expect.poll(visibleViews).toBe(2);
    await expect(split).not.toHaveAttribute("aria-valuenow", "53");
    const ratio = await split.getAttribute("aria-valuenow");
    await web.getByRole("textbox", { name: "Note" }).click();
    await prefix(desktop, web, "J");
    const browserBounds = await browser.boundingBox();
    const appBounds = await app.boundingBox();
    expect(browserBounds?.y).toBeGreaterThan(appBounds?.y ?? 0);
    await expect(web.getByRole("textbox", { name: "Note" })).toHaveValue(
      "retained reference",
    );
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect.poll(visibleViews).toBe(2);
    await expect(page.getByRole("alert")).toHaveCount(0);
    for (const panel of [terminal, second])
      await expect
        .poll(
          async () =>
            (await panel.locator(".terminal-surface").boundingBox())?.height ??
            0,
        )
        .toBeGreaterThan(24);
    for (const panel of [browser, app])
      await expect
        .poll(
          async () =>
            (await panel.locator(".browser-host").boundingBox())?.height ?? 0,
        )
        .toBeGreaterThan(24);
    await nativeCapture(desktop, "test-results/workbench-minimum-native.png");
    expect(errors).toEqual([]);
    await desktop.close();
    desktop = await electron.launch(options);
    const restored = await desktopWindow(desktop);
    await expect(restored.locator('[data-kind="terminal"]')).toHaveCount(2);
    await expect(
      restored.getByRole("separator", { name: "좌우 패널 크기" }).first(),
    ).toHaveAttribute("aria-valuenow", ratio ?? "");
    await expect.poll(visibleViews).toBe(2);
    expect(await restored.evaluate(() => window.terminal.list())).toEqual([]);
    expect(
      (await restored.evaluate(() => window.browser.snapshot())).tabs.map(
        (tab) => tab.url,
      ),
    ).toEqual([`${origin}/reference`]);
    expect(
      (await restored.evaluate(() => window.browser.snapshot("app"))).tabs.map(
        (tab) => tab.url,
      ),
    ).toEqual([`${origin}/app`]);
  } finally {
    await desktop.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
