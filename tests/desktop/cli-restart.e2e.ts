import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { modelAlias } from "../../src/main/proxy/model-mappings";
import { emptyMappings } from "../../src/shared/model-mappings";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";
import { prepareModelFixture } from "./model-fixture";

test("reopening restores the gateway, Fable selection and routed PowerShell commands", async () => {
  test.setTimeout(90_000);
  const directory = resolve(".local", `cli-restore-${randomUUID()}`);
  const data = resolve(directory, "data");
  const project = resolve(directory, "project");
  const bin = resolve(directory, "bin");
  const local = resolve(directory, "local");
  const agyBin = resolve(local, "agy", "bin");
  await Promise.all([
    mkdir(project, { recursive: true }),
    mkdir(bin, { recursive: true }),
    mkdir(agyBin, { recursive: true }),
  ]);
  const fixture = resolve(directory, "capture.cjs");
  const capture = resolve(directory, "capture.json");
  await writeFile(
    fixture,
    `if (process.argv.includes('--version')) { console.log('CLI fixture 1.0.0'); process.exit(0); }
const fs = require('node:fs');
fs.writeFileSync(process.env.TOMMYBROWN_CAPTURE, JSON.stringify({args: process.argv.slice(2), fable: process.env.ANTHROPIC_DEFAULT_FABLE_MODEL, agyModel: process.env.AGY_LLM_GATEWAY_MODELS, agyUrl: process.env.AGY_LLM_GATEWAY_URL, hasAgyKey: !!process.env.AGY_LLM_GATEWAY_API_KEY}));
console.log('routed-cli-ready');`,
  );
  for (const output of [resolve(bin, "claude.exe"), resolve(agyBin, "agy.exe")])
    execFileSync("bun", ["build", fixture, "--compile", "--outfile", output], {
      timeout: 30_000,
      windowsHide: true,
    });
  await prepareModelFixture(data);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value === undefined ||
      key === "ELECTRON_RUN_AS_NODE" ||
      key.startsWith("AGY_")
    )
      continue;
    env[key] = key.toLowerCase() === "path" ? `${bin};${value}` : value;
  }
  const options = {
    ...desktopCommand(),
    env: {
      ...env,
      LOCALAPPDATA: local,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_DATA_DIR: data,
      TOMMYBROWN_CAPTURE: capture,
    },
  };
  const desktop = await electron.launch(options);
  let target = "";
  try {
    const page = await desktopWindow(desktop);
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    target =
      snapshot.providerModels.codex.find((model) => !model.startsWith("tb-")) ??
      "";
    expect(target).not.toBe("");
    const mappings = emptyMappings();
    mappings.routes = { codex: null, claude: "codex", antigravity: "codex" };
    mappings.rows.push({
      id: randomUUID(),
      name: "Astra / Fable",
      claudeShortcut: "fable",
      models: { codex: target, claude: "fable", antigravity: "astra" },
    });
    await page.evaluate(
      (settings) => window.desktop.saveMappings(settings),
      mappings,
    );
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    const cli = page.getByLabel("CLI", { exact: true });
    const model = page.getByLabel("모델", { exact: true });
    await cli.selectOption("antigravity");
    await model.focus();
    await model.selectOption("astra");
    await cli.selectOption("claude");
    await model.selectOption("fable");
    await expect(model).toHaveValue("fable");
    await expect(
      page.getByRole("button", { name: "새 세션", exact: true }),
    ).toBeEnabled();
  } finally {
    await desktop.close();
  }

  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    await expect(page.getByLabel("CLI", { exact: true })).toHaveValue("claude");
    await expect(page.getByLabel("모델", { exact: true })).toHaveValue("fable");
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    expect(snapshot.gateway.phase).toBe("running");
    expect(snapshot.accounts).toHaveLength(3);
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect(page.locator(".xterm-rows")).toContainText("routed-cli-ready");
    const direct: unknown = JSON.parse(await readFile(capture, "utf8"));
    expect(direct).toMatchObject({
      args: ["--model", "fable", "--mcp-config", expect.any(String)],
      fable: modelAlias("codex", target),
    });
    await page.getByLabel("claude 1 종료", { exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.terminal.list()))
      .toEqual([]);
    await page.getByLabel("CLI", { exact: true }).selectOption("powershell");
    await expect(page.getByLabel("CLI", { exact: true })).toHaveValue(
      "powershell",
    );
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.terminal.list()))
      .toHaveLength(1);
    const [shell] = await page.evaluate(() => window.terminal.list());
    if (!shell) throw new Error("PowerShell session missing");
    expect(shell.cli).toBe("powershell");
    await expect(page.locator(".xterm-rows")).toContainText(`PS ${project}`);
    await page.evaluate(
      (id) => window.terminal.write(id, "antigravity --fixture\r"),
      shell.id,
    );
    await expect(page.locator(".xterm-rows")).toContainText("routed-cli-ready");
    await expect
      .poll(async () => JSON.parse(await readFile(capture, "utf8")))
      .toMatchObject({
        args: [
          "--model",
          "tb-agy-codex-astra",
          "--add-dir",
          expect.any(String),
          "--fixture",
        ],
        agyModel: "tb-agy-codex-astra",
        hasAgyKey: true,
      });
    await page.evaluate(
      (id) => window.terminal.write(id, "claude --fixture\r"),
      shell.id,
    );
    await expect
      .poll(async () => JSON.parse(await readFile(capture, "utf8")))
      .toMatchObject({
        args: [
          "--model",
          "fable",
          "--mcp-config",
          expect.any(String),
          "--fixture",
        ],
        fable: modelAlias("codex", target),
      });
    await nativeCapture(reopened, "test-results/cli-restart-native.png");
  } finally {
    await reopened.close();
  }
});
