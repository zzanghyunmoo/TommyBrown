import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { modelAlias } from "../../src/main/proxy/model-mappings";
import {
  cliLabels,
  providerLabels,
  providers,
} from "../../src/shared/model-mappings";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";
import { prepareModelFixture } from "./model-fixture";

test("edit, validate, route all six directions, and restore model mappings", async () => {
  test.setTimeout(90_000);
  const directory = resolve(".local", `desktop-mappings-${randomUUID()}`);
  await prepareModelFixture(directory);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  const options = {
    ...desktopCommand(),
    env: { ...env, TOMMYBROWN_TEST: "1", TOMMYBROWN_DATA_DIR: directory },
  };
  const desktop = await electron.launch(options);
  const models = { codex: "", claude: "", antigravity: "" };
  try {
    const page = await desktopWindow(desktop);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page
      .getByRole("button", { name: "게이트웨이 시작", exact: true })
      .click();
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    for (const provider of providers) {
      const model = snapshot.providerModels[provider][0];
      if (!model) throw new Error(`No ${provider} fixture model`);
      models[provider] = model;
    }
    await page.getByRole("button", { name: "예시 4행 추가" }).click();
    await expect(page.getByLabel("매핑 이름 4", { exact: true })).toHaveValue(
      "Lunar · Haiku",
    );
    await page.getByRole("button", { name: "변경 취소", exact: true }).click();
    await expect(page.getByLabel("매핑 이름 4", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "매핑 추가", exact: true }).click();
    await page.getByRole("button", { name: "매핑 저장", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("두 제공자");
    await page
      .getByLabel("매핑 이름 1", { exact: true })
      .fill("실행 모델 연결");
    for (const provider of providers)
      await page
        .getByLabel(`${providerLabels[provider]} 모델 1`, { exact: true })
        .fill(models[provider]);
    await page
      .getByLabel("Claude 단축 이름 1", { exact: true })
      .selectOption("opus");
    await page.getByRole("button", { name: "매핑 저장", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "매핑 저장", exact: true }),
    ).toBeDisabled();
    for (const cli of providers)
      for (const target of providers) {
        if (cli === target) continue;
        await page
          .getByLabel(`${cliLabels[cli]} 실행 제공자`, { exact: true })
          .selectOption(target);
        await page
          .getByRole("button", { name: "매핑 저장", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "매핑 저장", exact: true }),
        ).toBeDisabled();
        await page.getByLabel("사용할 CLI", { exact: true }).selectOption(cli);
        await page
          .getByLabel("사용할 모델", { exact: true })
          .selectOption(models[cli]);
        await expect(
          page.locator(".launch-controls .route-preview"),
        ).toContainText(`${providerLabels[target]} / ${models[target]}`);
        await page.getByRole("button", { name: /실행 명령 복사/ }).click();
        await expect(
          page.getByRole("button", { name: "실행 명령 복사됨", exact: true }),
        ).toBeVisible();
        const command = await desktop.evaluate(({ clipboard }) =>
          clipboard.readText(),
        );
        expect(command).toContain(modelAlias(target, models[target]));
        if (cli === "claude")
          expect(command).toContain("ANTHROPIC_DEFAULT_OPUS_MODEL");
      }
    await page
      .getByRole("button", { name: "매핑 1 삭제", exact: true })
      .click();
    await expect(page.getByLabel("매핑 이름 1", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "변경 취소", exact: true }).click();
    await expect(page.getByLabel("매핑 이름 1", { exact: true })).toHaveValue(
      "실행 모델 연결",
    );
    await page.getByRole("button", { name: "매핑 추가", exact: true }).click();
    await page.getByLabel("OpenAI 모델 2", { exact: true }).fill("spare-codex");
    await page
      .getByLabel("Claude 모델 2", { exact: true })
      .fill("spare-claude");
    await page.getByRole("button", { name: "매핑 저장", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.desktop.snapshot()).mappings.rows.length,
        ),
      )
      .toBe(2);
    await page
      .getByRole("button", { name: "매핑 2 삭제", exact: true })
      .click();
    await page.getByRole("button", { name: "매핑 저장", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.desktop.snapshot()).mappings.rows.length,
        ),
      )
      .toBe(1);
    await expect(page.getByLabel("매핑 이름 1", { exact: true })).toBeEnabled();
    await page
      .getByRole("heading", { name: "모델 매핑", exact: true })
      .scrollIntoViewIfNeeded();
    await nativeCapture(desktop, "test-results/model-mappings-native-wide.png");
    await page.screenshot({ path: "test-results/model-mappings-wide.png" });
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setSize(960, 640),
    );
    await page
      .getByRole("button", { name: "매핑 저장", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "매핑 저장", exact: true }),
    ).toBeInViewport();
    await nativeCapture(
      desktop,
      "test-results/model-mappings-native-compact.png",
    );
    await page.screenshot({ path: "test-results/model-mappings-compact.png" });
    expect(errors).toEqual([]);
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(page.getByLabel("매핑 이름 1", { exact: true })).toHaveValue(
      "실행 모델 연결",
    );
    await expect(
      page.getByLabel("Antigravity 실행 제공자", { exact: true }),
    ).toHaveValue("claude");
    await page
      .getByRole("button", { name: "게이트웨이 시작", exact: true })
      .click();
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    for (const provider of providers)
      expect(snapshot.providerModels[provider]).toContain(
        modelAlias(provider, models[provider]),
      );
  } finally {
    await reopened.close();
  }
});
