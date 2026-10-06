import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { z } from "zod";
import {
  antigravityAlias,
  modelAlias,
} from "../../src/main/proxy/model-mappings";
import {
  emptyMappings,
  providerLabels,
  providers,
} from "../../src/shared/model-mappings";
import { desktopCommand, desktopWindow } from "./launch";
import { prepareModelFixture } from "./model-fixture";

test("coding CLI shims receive exact MCP arguments and per-session credentials", async () => {
  test.setTimeout(90_000);
  const directory = resolve(".local", `desktop-cli-${randomUUID()}`);
  const project = resolve(directory, "project");
  const bin = resolve(directory, "bin with spaces");
  const capture = resolve(directory, "capture.json");
  await mkdir(project, { recursive: true });
  await mkdir(bin);
  const fixtureSource = [
    "#!/usr/bin/env node",
    'const fs = require("node:fs");',
    "const tokens = Object.entries(process.env).filter(([key]) => /^TOMMYBROWN_.*_TOKEN$/.test(key));",
    "fs.writeFileSync(process.env.TOMMYBROWN_CAPTURE, JSON.stringify({args: process.argv.slice(2), tokens: Object.fromEntries(tokens), electronFlag: process.env.ELECTRON_RUN_AS_NODE ?? null, opus: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? null, agyModel: process.env.AGY_LLM_GATEWAY_MODELS ?? null}));",
    'console.log("cli-shim-ready");',
    "setInterval(() => {}, 1000);",
  ].join("\n");
  for (const cli of ["claude", "codex"]) {
    const packageName =
      cli === "codex" ? "@openai/codex" : "@anthropic-ai/claude-code";
    const packageDirectory = resolve(bin, "node_modules", packageName);
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(
      resolve(packageDirectory, "package.json"),
      JSON.stringify({ type: "commonjs", bin: { [cli]: "cli.js" } }),
    );
    await writeFile(resolve(packageDirectory, "cli.js"), fixtureSource);
    await writeFile(
      resolve(bin, `${cli}.cmd`),
      `@"${process.execPath}" "%~dp0node_modules\\${packageName.replaceAll("/", "\\")}\\cli.js" %*\r\n`,
    );
  }
  const nativeSource = resolve(directory, "native-cli.cjs");
  await writeFile(nativeSource, fixtureSource);
  execFileSync(
    "bun",
    ["build", nativeSource, "--compile", "--outfile", resolve(bin, "agy.exe")],
    { timeout: 30_000, windowsHide: true },
  );
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key === "ELECTRON_RUN_AS_NODE") continue;
    env[key] = key.toLowerCase() === "path" ? `${bin};${value}` : value;
  }
  await prepareModelFixture(resolve(directory, "data"));
  const desktop = await electron.launch({
    ...desktopCommand(),
    env: {
      ...env,
      TOMMYBROWN_TEST: "1",
      TOMMYBROWN_DATA_DIR: resolve(directory, "data"),
      TOMMYBROWN_CAPTURE: capture,
    },
  });
  try {
    await desktop.evaluate(({ dialog, BrowserWindow }, path) => {
      BrowserWindow.getAllWindows()[0]?.show();
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, project);
    const page = await desktopWindow(desktop);
    await page
      .getByLabel("사용할 CLI", { exact: true })
      .selectOption("antigravity");
    await expect(page.getByLabel("사용할 CLI", { exact: true })).toHaveValue(
      "antigravity",
    );
    await expect(page.getByText("실행 중", { exact: true })).toBeVisible();
    const snapshot = await page.evaluate(() => window.desktop.snapshot());
    const models = { codex: "", claude: "", antigravity: "" };
    for (const provider of providers) {
      const model = snapshot.providerModels[provider][0];
      if (!model) throw new Error(`Missing ${provider} model`);
      models[provider] = model;
    }
    const mappings = emptyMappings();
    mappings.rows.push({
      id: randomUUID(),
      name: "CLI mapping",
      models,
      claudeShortcut: "opus",
    });
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    for (const cli of providers)
      for (const target of providers) {
        if (cli === target) continue;
        mappings.routes[cli] = target;
        await page.evaluate(
          (settings) => window.desktop.saveMappings(settings),
          mappings,
        );
        await page.getByLabel("CLI", { exact: true }).selectOption(cli);
        const select = page.getByLabel("모델", { exact: true });
        await select.focus();
        await expect(
          select.locator("option", { hasText: models[cli] }),
        ).toHaveCount(1);
        await select.selectOption(models[cli]);
        await expect(
          page.locator(".terminal-panel .route-preview"),
        ).toContainText(`${providerLabels[target]} / ${models[target]}`);
        await page
          .getByRole("button", { name: "새 세션", exact: true })
          .click();
        await expect(page.locator(".xterm-rows")).toContainText(
          "cli-shim-ready",
        );
        const record = z
          .object({
            args: z.array(z.string()),
            opus: z.string().nullable(),
            agyModel: z.string().nullable(),
          })
          .parse(JSON.parse(await readFile(capture, "utf8")));
        if (cli !== "antigravity")
          expect(record.args).toContain(modelAlias(target, models[target]));
        if (cli === "claude")
          expect(record.opus).toBe(modelAlias(target, models[target]));
        if (cli === "antigravity")
          expect(record.agyModel).toBe(
            antigravityAlias(target, models.antigravity),
          );
        await page
          .getByRole("button", { name: `${cli} 1 종료`, exact: true })
          .click();
        await expect
          .poll(() => page.evaluate(() => window.terminal.list()))
          .toEqual([]);
      }
    await page.getByLabel("모델", { exact: true }).selectOption("");
    const endpoint = "https://example.com/a&b/(mcp)";
    const [connector] = await page.evaluate(
      (url) =>
        window.connectors.add({
          kind: "github",
          name: "CLI fixture",
          webUrl: "https://github.com/",
          endpoint: url,
          token: "fixture-token",
        }),
      endpoint,
    );
    if (!connector) throw new Error("No connector");
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByLabel("CLI", { exact: true }).selectOption("claude");
    await page.locator(".terminal-connectors summary").click();
    await page.getByRole("checkbox", { name: "CLI fixture" }).check();
    const recordSchema = z.object({
      args: z.array(z.string()),
      tokens: z.record(z.string(), z.string()),
      electronFlag: z.null(),
    });
    for (const cli of ["claude", "codex", "antigravity"] as const) {
      await page.getByLabel("CLI", { exact: true }).selectOption(cli);
      await page.getByLabel("모델", { exact: true }).selectOption("");
      await page.getByRole("button", { name: "새 세션", exact: true }).click();
      await test.step(`${cli} produces terminal output`, async () => {
        await expect(page.locator(".xterm-rows")).toContainText(
          "cli-shim-ready",
        );
      });
      const record = recordSchema.parse(
        JSON.parse(await readFile(capture, "utf8")),
      );
      expect(JSON.stringify(record)).not.toContain("fixture-token");
      expect(JSON.stringify(record)).not.toContain(endpoint);
      if (cli === "codex") {
        expect(record.tokens["TOMMYBROWN_MCP_TOKEN"]).toMatch(
          /^[a-zA-Z0-9_-]{43}$/,
        );
        expect(record.args[1]).toMatch(
          /^mcp_servers\.tommybrown\.url="http:\/\/127\.0\.0\.1:\d+\/mcp"$/,
        );
        expect(record.args).toEqual([
          "-c",
          record.args[1],
          "-c",
          'mcp_servers.tommybrown.bearer_token_env_var="TOMMYBROWN_MCP_TOKEN"',
        ]);
      } else {
        expect(record.tokens).toEqual({});
        expect(record.args).toHaveLength(2);
        expect(record.args[0]).toBe(
          cli === "claude" ? "--mcp-config" : "--add-dir",
        );
        const path = record.args[1];
        if (!path) throw new Error("No managed MCP configuration");
        const configPath =
          cli === "claude"
            ? path
            : resolve(path, ".agents/plugins/tommybrown/mcp_config.json");
        const config = z
          .object({
            mcpServers: z.object({
              tommybrown: z.object({
                url: z.string(),
                headers: z.object({ Authorization: z.string() }),
              }),
            }),
          })
          .parse(JSON.parse(await readFile(configPath, "utf8")));
        expect(config.mcpServers.tommybrown.url).toMatch(
          /^http:\/\/127\.0\.0\.1:\d+\/mcp$/,
        );
        expect(config.mcpServers.tommybrown.headers.Authorization).toMatch(
          /^Bearer [a-zA-Z0-9_-]{43}$/,
        );
        expect(JSON.stringify(config)).not.toContain("fixture-token");
        expect(JSON.stringify(config)).not.toContain(endpoint);
      }
      await test.step(`${cli} closes its process tree`, async () => {
        if (cli === "antigravity") {
          await page.evaluate(
            (id) => window.connectors.disconnect(id),
            connector.id,
          );
        } else {
          await page
            .getByRole("button", { name: `${cli} 1 종료`, exact: true })
            .click();
        }
        await expect
          .poll(() => page.evaluate(() => window.terminal.list()))
          .toEqual([]);
      });
    }
    await expect(page.locator(".terminal-connectors")).toHaveCount(1);
  } finally {
    await desktop.close();
  }
});
