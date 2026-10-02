import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("offline vault search, preview, and save work without any remote requests", async () => {
  const directory = resolve(".local", `desktop-vault-${randomUUID()}`);
  const vault = resolve(directory, "vault");
  await mkdir(vault, { recursive: true });
  await writeFile(
    resolve(vault, "offline.md"),
    "# 로컬 노트\n검색용 키워드\n![external](https://example.com/remote.png)",
  );
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
    await desktop.evaluate(({ dialog, session }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*"] },
        (_request, callback) => callback({ cancel: true }),
      );
    }, vault);
    const page = await desktopWindow(desktop);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await desktop.context().setOffline(true);
    await page
      .getByRole("button", { name: "Obsidian 보관함", exact: true })
      .click();
    await page.getByRole("textbox", { name: "보관함 검색어" }).fill("키워드");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.getByRole("button", { name: /offline.md:2/ }).click();
    await expect(page.locator(".view-lines")).toContainText("로컬 노트");
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "로컬 노트" }),
    ).toBeVisible();
    await expect(page.locator(".markdown-preview img")).toHaveCount(0);
    await page.screenshot({ path: "test-results/offline-vault.png" });
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await page
      .locator(".monaco-editor .view-lines")
      .click({ position: { x: 70, y: 10 } });
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("# 오프라인 저장 완료\n");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect
      .poll(() => readFile(resolve(vault, "offline.md"), "utf8"))
      .toBe("# 오프라인 저장 완료\n");
    expect(requests).toEqual([]);
  } finally {
    await desktop.close();
  }
});
