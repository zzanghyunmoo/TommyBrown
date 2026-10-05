import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("embedded web pages are isolated and terminal links open in the right pane", async () => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      `<html><head><title>Browser fixture</title></head><body style="font-family:system-ui;padding:24px"><h1>${request.url === "/next" ? "Next page" : "Browser isolation check"}</h1><p>A real page rendered in an isolated WebContentsView.</p><a href="/next">Next</a></body></html>`,
    );
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing local server port");
  const url = `http://127.0.0.1:${address.port}/`;
  const directory = resolve(".local", `desktop-browser-${randomUUID()}`);
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const desktop = await electron.launch({
    ...desktopCommand(),
    env: {
      ...env,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_DATA_DIR: resolve(directory, "data"),
    },
  });
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
      .locator(".workbench-toolbar")
      .getByRole("button", { name: "브라우저", exact: true })
      .click();
    await page.getByRole("textbox", { name: "웹 주소", exact: true }).fill(url);
    await page
      .getByRole("region", { name: "내장 브라우저", exact: true })
      .getByRole("button", { name: "이동", exact: true })
      .click();
    await expect
      .poll(() =>
        desktop
          .context()
          .pages()
          .map((candidate) => candidate.url()),
      )
      .toContain(url);
    const web = desktop
      .context()
      .pages()
      .find((candidate) => candidate.url() === url);
    if (!web) throw new Error("Embedded browser page was not created");
    await expect(
      web.getByRole("heading", { name: "Browser isolation check" }),
    ).toBeVisible();
    expect(
      await web.evaluate(() => ({
        node: "require" in window,
        accounts: "desktop" in window,
        files: "workspace" in window,
        terminals: "terminal" in window,
      })),
    ).toEqual({ node: false, accounts: false, files: false, terminals: false });
    await web.getByRole("link", { name: "Next", exact: true }).click();
    await expect(web.getByRole("heading", { name: "Next page" })).toBeVisible();
    await page
      .getByRole("region", { name: "내장 브라우저", exact: true })
      .getByRole("button", { name: "뒤로", exact: true })
      .click();
    await expect(
      web.getByRole("heading", { name: "Browser isolation check" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await page.locator(".xterm-screen").click();
    await page.keyboard.type(`Write-Output '${url}'`);
    await page.keyboard.press("Enter");
    const linkRow = page
      .locator(".xterm-rows > div")
      .filter({ hasText: url })
      .last();
    await expect(linkRow).toBeVisible();
    const linkBounds = await linkRow.boundingBox();
    if (!linkBounds) throw new Error("Terminal link has no visible bounds");
    await page.mouse.move(linkBounds.x + 40, linkBounds.y + 8);
    await expect(page.locator(".xterm-screen")).toHaveClass(
      /xterm-cursor-pointer/,
    );
    await page.mouse.click(linkBounds.x + 40, linkBounds.y + 8);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.browser.snapshot().then((state) => state.tabs.length),
        ),
      )
      .toBe(2);
    await page.screenshot({ path: "test-results/ade-browser-controls.png" });
    await web.screenshot({ path: "test-results/embedded-browser-page.png" });
    await nativeCapture(desktop, "test-results/native-browser-composite.png");
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({ path: "test-results/browser-minimum-width.png" });
    await nativeCapture(
      desktop,
      "test-results/native-browser-minimum-width.png",
    );
    await page.getByRole("button", { name: "코드·문서", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "문서 작업 영역" }),
    ).toBeVisible();
  } finally {
    await desktop.close();
    await new Promise<void>((closed, reject) =>
      server.close((error) => (error ? reject(error) : closed())),
    );
  }
});
