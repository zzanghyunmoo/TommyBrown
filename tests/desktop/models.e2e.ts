import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { desktopCommand, desktopWindow } from "./launch";

test("install, start, stop, and restore the real native model gateway", async () => {
  const directory = resolve(".local", `desktop-models-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: { ...env, TOMMYBROWN_TEST: "1", TOMMYBROWN_DATA_DIR: directory },
  };
  const desktop = await electron.launch(options);
  let encryptedHash = "";
  try {
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(
      page.getByRole("heading", { name: "모델 연결", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Claude Code 계정 연결" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "엔진 설치", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "게이트웨이 시작", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("button", { name: "게이트웨이 시작", exact: true })
      .click();
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Claude Code 계정 연결" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Codex 계정 연결" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Antigravity 계정 연결" }),
    ).toBeEnabled();
    await expect(page.locator(".statusbar")).toBeInViewport();
    await expect(page.locator(".sidebar-footer")).toBeInViewport();
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    expect(snapshot.gateway.phase).toBe("running");
    expect(snapshot.accounts).toEqual([]);
    expect(snapshot.models).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /secret-key|management-key|access_token/,
    );
    await page.screenshot({ path: "test-results/model-access-running.png" });
    await page.getByRole("button", { name: "중지", exact: true }).click();
    await expect(page.getByText("정지됨", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Claude Code 계정 연결" }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
    encryptedHash = createHash("sha256")
      .update(await readFile(resolve(directory, "gateway-keys.encrypted")))
      .digest("hex");
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    expect(
      createHash("sha256")
        .update(await readFile(resolve(directory, "gateway-keys.encrypted")))
        .digest("hex"),
    ).toBe(encryptedHash);
  } finally {
    await reopened.close();
  }
});
