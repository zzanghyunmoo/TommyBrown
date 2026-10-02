import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("native component showcase preserves keyboard access and bounded layout", async () => {
  const directory = resolve(".local", `showcase-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const desktop = await electron.launch({
    ...desktopCommand(),
    env: {
      ...env,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_SHOWCASE: "1",
      TOMMYBROWN_DATA_DIR: directory,
    },
  });
  try {
    const page = await desktopWindow(desktop);
    await expect(
      page.getByRole("heading", { name: "TommyBrown controls" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "계정 연결", exact: true }).focus();
    await expect(
      page.getByRole("button", { name: "계정 연결", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "사용 불가" }),
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("연결할 수 없습니다");
    for (const width of [1320, 768, 375]) {
      await desktop.evaluate(({ BrowserWindow }, nextWidth) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error("No native window");
        window.setMinimumSize(360, 400);
        window.setSize(nextWidth, 880);
      }, width);
      await page.screenshot({
        path: `test-results/showcase-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    const secrets = await readFile(
      resolve(directory, "gateway-keys.encrypted"),
    );
    expect(secrets.toString()).not.toContain('"management"');
    expect(await page.evaluate(() => typeof window.desktop.snapshot)).toBe(
      "function",
    );
    expect(await page.evaluate(() => Object.hasOwn(window, "require"))).toBe(
      false,
    );
  } finally {
    await desktop.close();
  }
});
