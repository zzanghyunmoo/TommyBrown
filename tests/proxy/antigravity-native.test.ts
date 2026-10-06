import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node-pty";
import { expect, it } from "vitest";
import { z } from "zod";
import { createLaunchProfile } from "../../src/main/proxy/profiles";
import { resolveCli } from "../../src/main/terminal/resolve-cli";

it.runIf(process.env["TOMMYBROWN_NATIVE_AGY"] === "1")(
  "selects and switches gateway models in the installed interactive Antigravity CLI",
  async () => {
    const directory = resolve(".local", `native-agy-${Date.now()}`);
    await mkdir(directory, { recursive: true });
    const models = ["tb-agy-codex-gemini-4-argon", "tb-agy-codex-gemini-pro"];
    const requests: string[] = [];
    const server = createServer(async (request, response) => {
      if (request.method !== "POST") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            data: models.map((id) => ({ id, object: "model" })),
          }),
        );
        return;
      }
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = z.object({ model: z.string() }).parse(JSON.parse(raw));
      requests.push(body.model);
      const base = {
        id: "fixture",
        created: 1,
        model: body.model,
        object: "chat.completion.chunk",
      };
      response.setHeader("content-type", "text/event-stream");
      response.end(
        `${[
          {
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  content: body.model === models[0] ? "ARGON_OK" : "PRO_OK",
                },
                finish_reason: null,
              },
            ],
          },
          {
            ...base,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          },
        ]
          .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
          .join("")}data: [DONE]\n\n`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing fixture port");
    const selected = models[0];
    const alternative = models[1];
    if (!selected || !alternative) throw new Error("Missing test model");
    const profile = createLaunchProfile(
      { cli: "antigravity", model: selected },
      { port: address.port, key: "fixture-key" },
    );
    const executable = await resolveCli("antigravity");
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env))
      if (
        value !== undefined &&
        key !== "ELECTRON_RUN_AS_NODE" &&
        !key.startsWith("AGY_")
      )
        env[key] = value;
    for (const [key, value] of Object.entries(profile.environment))
      if (value !== null) env[key] = value;
    env["AGY_LLM_GATEWAY_MODELS"] = models.join(",");
    env["AGY_CLI_DISABLE_AUTO_UPDATE"] = "1";
    const log = resolve(directory, "agy.log");
    const terminal = spawn(
      executable.executable,
      [...profile.args, "--sandbox", "--log-file", log],
      { cwd: directory, env, cols: 120, rows: 35 },
    );
    let output = "";
    let exited = false;
    terminal.onData((data) => {
      output += data;
      if (data.includes("\x1b[6n")) terminal.write("\x1b[1;1R");
    });
    terminal.onExit(() => {
      exited = true;
    });
    const type = async (text: string) => {
      terminal.write(text);
      await delay(300);
      terminal.write("\r");
    };
    try {
      await expect
        .poll(
          () =>
            output.includes("Do you trust") ||
            output.includes("Enterprise Gateway"),
          { timeout: 15000 },
        )
        .toBe(true);
      if (output.includes("Do you trust")) terminal.write("\r");
      await expect
        .poll(() => output, { timeout: 15000 })
        .toContain("Enterprise Gateway");
      await type("Return a verification marker without using tools.");
      await expect.poll(() => output, { timeout: 15000 }).toContain("ARGON_OK");
      await type("/model");
      await expect.poll(() => output).toContain("Switch Model");
      expect(output).toContain(alternative);
      terminal.write("\x1b[B");
      await delay(300);
      terminal.write("\r");
      await delay(500);
      await type("Return a second verification marker without tools.");
      await expect.poll(() => output, { timeout: 15000 }).toContain("PRO_OK");
      expect(requests).toContain(selected);
      expect(requests).toContain(alternative);
    } finally {
      await writeFile(resolve(directory, "terminal.txt"), output);
      if (!exited) {
        terminal.write("\x1b");
        await delay(200);
        await type("/exit");
        for (let i = 0; i < 10 && !exited; i++) await delay(200);
        if (!exited) terminal.kill();
      }
      server.closeAllConnections();
      server.close();
    }
  },
  60000,
);
