import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("choose a real space, preserve drafts across tabs, save and detect conflicts", async () => {
  const directory = resolve(".local", `desktop-documents-${randomUUID()}`);
  const project = resolve(directory, "project");
  await mkdir(project, { recursive: true });
  await writeFile(resolve(project, "note.md"), "# Initial note\n");
  await writeFile(resolve(project, "index.ts"), "export const answer = 42;\n");
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
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    }, project);
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByRole("button", { name: "코드·문서", exact: true }).click();
    await page.getByRole("button", { name: "note.md", exact: true }).click();
    const editor = page.getByRole("textbox", { name: /문서 편집기 note.md/ });
    await expect(editor).toBeVisible();
    await page
      .locator(".monaco-editor .view-lines")
      .click({ position: { x: 80, y: 10 } });
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("# Draft kept across tabs\n");
    await page.getByRole("button", { name: "index.ts", exact: true }).click();
    await page.getByRole("tab", { name: /note.md/ }).click();
    await expect(page.locator(".view-lines")).toContainText(
      "Draft kept across tabs",
    );
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect
      .poll(() => readFile(resolve(project, "note.md"), "utf8"))
      .toBe("# Draft kept across tabs\n");
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Draft kept across tabs" }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/workspace-documents.png" });
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await writeFile(resolve(project, "note.md"), "external change");
    await page
      .locator(".monaco-editor .view-lines")
      .click({ position: { x: 80, y: 10 } });
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("unsaved local change");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "changed outside" }),
    ).toBeVisible();
    expect(await readFile(resolve(project, "note.md"), "utf8")).toBe(
      "external change",
    );
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(
      page.getByRole("tab", { name: "note.md", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".view-lines")).toContainText("external change");
    await expect(
      page.getByRole("region", { name: "파일 탐색기" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "note.md", exact: true }),
    ).toBeVisible();
  } finally {
    await reopened.close();
  }
});
