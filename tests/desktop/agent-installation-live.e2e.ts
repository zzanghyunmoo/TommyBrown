import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";
import { agentNames } from "../../src/shared/agents";
import { desktopCommand, desktopWindow, nativeCapture } from "./launch";

test("official installers work on a disposable native runner and remain discoverable after restart", async () => {
  test.skip(
    process.env["TOMMYBROWN_LIVE_AGENT_INSTALL"] !== "1" ||
      process.env["GITHUB_ACTIONS"] !== "true",
    "Opt-in disposable GitHub-hosted runner only",
  );
  test.setTimeout(25 * 60_000);
  const directory = resolve(".local", `agent-live-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        key !== "ELECTRON_RUN_AS_NODE" &&
        !/^(CODEX_|CLAUDE_|ANTHROPIC_|AGY_|XDG_)/.test(key),
    ),
  );
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
    const page = await desktopWindow(desktop);
    await page.getByRole("tab", { name: "일반·색상", exact: true }).click();
    const general = page.getByRole("tabpanel", {
      name: "일반·색상",
      exact: true,
    });
    for (const id of ["codex", "claude", "antigravity"] as const) {
      const card = general.getByRole("region", {
        name: `${agentNames[id]} 설치`,
        exact: true,
      });
      await expect(
        card.getByRole("button", {
          name: `${agentNames[id]} 설치`,
          exact: true,
        }),
      ).toBeEnabled({ timeout: 30_000 });
      await card
        .getByRole("button", { name: `${agentNames[id]} 설치`, exact: true })
        .click();
      await expect
        .poll(
          async () => {
            const state = (
              await page.evaluate(() => window.agents.snapshot())
            ).find((item) => item.id === id);
            return state?.phase;
          },
          { timeout: 12 * 60_000, intervals: [1000, 2000, 5000] },
        )
        .toMatch(/^(installed|failed)$/);
      const verified = (
        await page.evaluate(() => window.agents.snapshot())
      ).find((item) => item.id === id);
      expect(
        verified?.phase,
        `${id}: ${verified?.message}\n${verified?.log}`,
      ).toBe("installed");
      await card.scrollIntoViewIfNeeded();
      await nativeCapture(
        desktop,
        `test-results/agent-live-${id}-${process.platform}-${process.arch}.png`,
      );
    }
    const result = await page.evaluate(() => window.agents.snapshot());
    expect(result.every((item) => item.version && item.path)).toBe(true);
    console.log(
      JSON.stringify(result.map(({ id, version }) => ({ id, version }))),
    );
    await desktop.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, directory);
    await page.getByRole("button", { name: "공간 열기", exact: true }).click();
    await page.getByLabel("CLI", { exact: true }).selectOption("powershell");
    await page.getByRole("button", { name: "새 세션", exact: true }).click();
    for (const [id, command] of [
      ["codex", "codex"],
      ["claude", "claude"],
      ["antigravity", "agy"],
    ] as const) {
      const version = result.find((item) => item.id === id)?.version;
      if (!version) throw new Error("Missing version");
      const session = (await page.evaluate(() => window.terminal.list()))[0];
      if (!session) throw new Error("Missing session");
      await page.evaluate(
        ({ sessionId, command }) =>
          window.terminal.write(sessionId, `${command} --version\r`),
        { sessionId: session.id, command },
      );
      await expect(page.locator(".xterm-rows")).toContainText(version, {
        timeout: 30_000,
      });
    }
    await nativeCapture(
      desktop,
      `test-results/agent-live-terminal-${process.platform}-${process.arch}.png`,
    );
  } finally {
    await desktop.close();
  }
  const reopened = await electron.launch(options);
  try {
    const page = await desktopWindow(reopened);
    const states = await page.evaluate(() => window.agents.refresh());
    expect(states.map((state) => state.phase)).toEqual([
      "installed",
      "installed",
      "installed",
    ]);
  } finally {
    await reopened.close();
  }
});
