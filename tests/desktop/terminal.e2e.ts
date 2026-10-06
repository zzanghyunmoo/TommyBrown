import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("native PTY stays alive across tabs and owned processes stop", async () => {
  const directory = resolve(".local", `desktop-terminal-${randomUUID()}`);
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const desktop = await electron.launch({
    ...desktopCommand(),
    env: {
      ...env,
      NO_COLOR: "1",
      TERM: "dumb",
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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await page.locator(".xterm-screen").click();
    await page.keyboard.type("Write-Output ('desktop-' + 'pty-ok')");
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm-rows")).toContainText("desktop-pty-ok");
    const initial = await page.evaluate(() => window.terminal.list());
    expect(initial).toHaveLength(1);
    const terminal = initial[0];
    if (!terminal) throw new Error("No terminal");
    await page.evaluate(
      (id) =>
        window.terminal.write(
          id,
          "Write-Output ('color-env:' + $env:TERM + ':' + $env:COLORTERM + ':' + $env:FORCE_COLOR + ':' + $env:NO_COLOR); Write-Host ('TB-' + 'RED') -ForegroundColor Red; Write-Host ('TB-' + 'GREEN') -ForegroundColor Green; Write-Host ('TB-' + 'CYAN') -ForegroundColor Cyan\r",
        ),
      terminal.id,
    );
    await expect(page.locator(".xterm-rows")).toContainText(
      "color-env:xterm-256color:truecolor:3:",
    );
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("화면 테마", { exact: true }).selectOption(theme);
      const colors: string[] = [];
      for (const text of ["TB-RED", "TB-GREEN", "TB-CYAN"]) {
        const output = page
          .locator(".xterm-rows span")
          .filter({ hasText: text })
          .last();
        await expect(output).toBeVisible();
        colors.push(
          await output.evaluate((element) => getComputedStyle(element).color),
        );
      }
      expect(new Set(colors).size).toBe(3);
      await nativeCapture(
        desktop,
        `test-results/terminal-colors-${theme}-native.png`,
      );
    }
    await page
      .getByRole("button", { name: "모델 연결", exact: true })
      .first()
      .click();
    await page.locator(".space-row").filter({ hasText: "project" }).click();
    await expect(page.locator(".xterm-rows")).toContainText("desktop-pty-ok");
    expect(await page.evaluate(() => window.terminal.list())).toEqual(initial);
    await page.screenshot({ path: "test-results/ade-terminal.png" });
    await page
      .getByRole("button", { name: "powershell 1 종료", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.terminal.list()))
      .toEqual([]);
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect(page.locator(".xterm-screen")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
});
