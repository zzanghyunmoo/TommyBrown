import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("themes retain live work and persist across reload and restart", async () => {
  test.setTimeout(90_000);
  const directory = resolve(".local", `desktop-themes-${randomUUID()}`);
  const project = resolve(directory, "Theme workspace");
  const data = resolve(directory, "data");
  await mkdir(project, { recursive: true });
  await mkdir(data, { recursive: true });
  await writeFile(resolve(project, "note.md"), "# Theme verification\n");
  await writeFile(resolve(data, "appearance.json"), '"light"');
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: { ...env, TOMMYBROWN_TEST: "1", TOMMYBROWN_DATA_DIR: data },
  };
  const desktop = await electron.launch(options);
  try {
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    }, project);
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const choice = page.getByRole("combobox", { name: "화면 테마" });
    await expect(choice).toHaveValue("light");
    for (const theme of ["light", "dark"]) {
      await choice.selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.screenshot({
        path: `test-results/themes-settings-${theme}.png`,
      });
      await nativeCapture(
        desktop,
        `test-results/themes-settings-${theme}-native.png`,
      );
      const ratios = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (token: string) => {
          const raw = style.getPropertyValue(token).trim().slice(1);
          const hex =
            raw.length === 3
              ? [...raw].map((digit) => digit + digit).join("")
              : raw;
          const channel = (offset: number) => {
            const value =
              Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          };
          return (
            channel(0) * 0.2126 + channel(2) * 0.7152 + channel(4) * 0.0722
          );
        };
        return [
          ["--ink", "--paper"],
          ["--muted", "--canvas"],
          ["--muted", "--paper"],
          ["--muted", "--surface"],
          ["--accent", "--paper"],
          ["--on-accent", "--accent"],
          ["--success", "--success-wash"],
          ["--danger", "--danger-wash"],
          ["--warning", "--warning-wash"],
          ["--terminal-ink", "--terminal"],
        ].map(([foreground, background]) => {
          if (!foreground || !background)
            throw new Error("Missing contrast pair");
          const a = luminance(foreground);
          const b = luminance(background);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      });
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await page.locator(".xterm-screen").click();
    await page.keyboard.type("Write-Output 'Theme session retained'");
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm-rows")).toContainText(
      "Theme session retained",
    );
    const sessions = await page.evaluate(() => window.terminal.list());
    await page.getByRole("tab", { name: "코드·문서", exact: true }).click();
    await page.getByRole("button", { name: "note.md", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: /문서 편집기 note.md/ }),
    ).toBeVisible();
    await page
      .locator(".monaco-editor .view-lines")
      .click({ position: { x: 80, y: 10 } });
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("# Unsaved theme draft\n");
    for (const theme of ["light", "dark"]) {
      await choice.selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".view-lines")).toContainText(
        "Unsaved theme draft",
      );
      const editorBackground = await page
        .locator(".monaco-editor")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(editorBackground).toBe(
        theme === "dark" ? "rgb(29, 32, 37)" : "rgb(249, 250, 251)",
      );
      await nativeCapture(
        desktop,
        `test-results/themes-editor-${theme}-native.png`,
      );
      await page.getByRole("tab", { name: "터미널", exact: true }).click();
      expect(await page.evaluate(() => window.terminal.list())).toEqual(
        sessions,
      );
      await expect(page.locator(".xterm-rows")).toContainText(
        "Theme session retained",
      );
      await expect(page.locator(".xterm-scrollable-element")).toHaveCSS(
        "background-color",
        theme === "dark" ? "rgb(20, 23, 28)" : "rgb(252, 252, 253)",
      );
      await expect(page.locator(".xterm-rows")).toHaveCSS(
        "color",
        theme === "dark" ? "rgb(224, 229, 238)" : "rgb(48, 53, 63)",
      );
      await nativeCapture(
        desktop,
        `test-results/themes-terminal-${theme}-native.png`,
      );
      await page.getByRole("tab", { name: "커넥터", exact: true }).click();
      await nativeCapture(
        desktop,
        `test-results/themes-connectors-${theme}-native.png`,
      );
      await page.getByRole("tab", { name: "코드·문서", exact: true }).click();
    }
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect
      .poll(() => readFile(resolve(project, "note.md"), "utf8"))
      .toBe("# Unsaved theme draft\n");
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    for (const theme of ["light", "dark"]) {
      await choice.selectOption(theme);
      await expect(choice).toBeEnabled();
      await expect(choice).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await nativeCapture(
        desktop,
        `test-results/themes-minimum-${theme}-native.png`,
      );
    }
    await choice.focus();
    await expect(choice).toBeFocused();
    await choice.press("Home");
    await choice.press("Enter");
    await expect(choice).toHaveValue("light");
    await expect(choice).toBeEnabled();
    await expect(choice).toBeFocused();
    await page.getByRole("button", { name: "사이드바 표시 전환" }).click();
    await expect(choice).toBeInViewport();
    await choice.selectOption("dark");
    await expect(choice).toBeEnabled();
    expect(
      await desktop.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    ).toBe("dark");
    await page.reload();
    await expect(choice).toHaveValue("dark");
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(page.getByRole("combobox", { name: "화면 테마" })).toHaveValue(
      "dark",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await reopened.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    ).toBe("dark");
  } finally {
    await reopened.close();
  }
});
