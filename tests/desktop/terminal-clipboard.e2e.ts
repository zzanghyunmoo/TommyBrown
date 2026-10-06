import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  test,
} from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

async function shortcut(desktop: ElectronApplication, key: string) {
  await desktop.evaluate(({ BrowserWindow }, key) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    if (!contents) throw new Error("Missing desktop window");
    contents.sendInputEvent({ type: "keyDown", keyCode: "Control" });
    contents.sendInputEvent({
      type: "keyDown",
      keyCode: "Shift",
      modifiers: ["control"],
    });
    contents.sendInputEvent({
      type: "keyDown",
      keyCode: key,
      modifiers: ["control", "shift"],
    });
    contents.sendInputEvent({
      type: "keyUp",
      keyCode: key,
      modifiers: ["control", "shift"],
    });
    contents.sendInputEvent({
      type: "keyUp",
      keyCode: "Shift",
      modifiers: ["control"],
    });
    contents.sendInputEvent({ type: "keyUp", keyCode: "Control" });
  }, key);
}

test("terminal copies selection and pastes Windows clipboard with native shortcuts", async () => {
  const directory = resolve(".local", `clipboard-${randomUUID()}`);
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
  const originalClipboard = await desktop.evaluate(({ clipboard }) =>
    clipboard.readText(),
  );
  try {
    await desktop.evaluate(({ dialog, BrowserWindow }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
      BrowserWindow.getAllWindows()[0]?.show();
      BrowserWindow.getAllWindows()[0]?.focus();
    }, project);
    const page = await desktopWindow(desktop);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    const rows = page.locator(".xterm-rows");
    await expect(rows).toContainText("PS ");
    await page.locator(".xterm-screen").click();
    await desktop.evaluate(({ clipboard }) =>
      clipboard.writeText("Write-Output ('CLIP' + 'BOARDOK')"),
    );
    await shortcut(desktop, "V");
    await expect(rows).toContainText("Write-Output ('CLIP' + 'BOARDOK')");
    await expect(rows).not.toContainText("CLIPBOARDOK");
    await page.keyboard.press("Enter");
    const output = rows
      .locator("span")
      .filter({ hasText: /^CLIPBOARDOK$/ })
      .last();
    await expect(output).toBeVisible();
    const bounds = await output.boundingBox();
    if (!bounds) throw new Error("Missing output bounds");
    await page.mouse.dblclick(bounds.x + 12, bounds.y + bounds.height / 2);
    await shortcut(desktop, "C");
    await expect
      .poll(() => desktop.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe("CLIPBOARDOK");
    await page.locator(".xterm-screen").click();
    await shortcut(desktop, "C");
    expect(
      await desktop.evaluate(({ clipboard }) => clipboard.readText()),
    ).toBe("CLIPBOARDOK");
    await page.keyboard.type(
      "Write-Output ('INTERRUPT' + 'START'); Start-Sleep -Seconds 30; Write-Output ('BAD' + 'FINISH')",
    );
    await page.keyboard.press("Enter");
    await expect(rows).toContainText("INTERRUPTSTART");
    await page.keyboard.press("Control+c");
    await expect(rows).toContainText(/INTERRUPTSTARTPS .*project> /);
    await page.keyboard.type("Write-Output ('AFTER' + 'INTERRUPT')");
    await page.keyboard.press("Enter");
    await expect(rows).toContainText("AFTERINTERRUPT");
    await expect(rows).not.toContainText("BADFINISH");
    expect(
      await desktop.evaluate(({ clipboard }) => clipboard.readText()),
    ).toBe("CLIPBOARDOK");
    await nativeCapture(desktop, "test-results/terminal-clipboard-native.png");
    await page.keyboard.type(
      "node -e \"process.stdin.setRawMode(true); process.stdout.write('\\x1b[?2004hPASTE_READY'); process.stdin.once('data', data => { process.stdout.write('\\x1b[?2004lPACKET:' + data.toString('base64')); process.exit(0); });\"",
    );
    await page.keyboard.press("Enter");
    await expect(
      rows.locator("span").filter({ hasText: /^PASTE_READY$/ }),
    ).toBeVisible();
    await desktop.evaluate(({ clipboard }) =>
      clipboard.writeText("한글 첫 줄\nsecond line"),
    );
    await shortcut(desktop, "V");
    await expect(rows).toContainText(
      `PACKET:${Buffer.from("\x1b[200~한글 첫 줄\rsecond line\x1b[201~").toString("base64")}`,
    );
    await desktop.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("terminal:clipboard-read");
      ipcMain.handle(
        "terminal:clipboard-read",
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("LATE_PASTE_MUST_NOT_APPEAR"), 300),
          ),
      );
    });
    await shortcut(desktop, "V");
    await page.getByLabel("CLI", { exact: true }).focus();
    await page.evaluate(() => window.terminal.readClipboard());
    await expect(rows).not.toContainText("LATE_PASTE_MUST_NOT_APPEAR");
  } finally {
    await desktop.evaluate(
      ({ clipboard }, text) => clipboard.writeText(text),
      originalClipboard,
    );
    await desktop.close();
  }
});
