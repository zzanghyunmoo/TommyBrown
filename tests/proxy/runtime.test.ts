import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProxyKeys } from "../../src/main/proxy/config";
import { ProxyRuntime } from "../../src/main/proxy/runtime";

const owned: { runtime: ProxyRuntime; directory: string }[] = [];
afterEach(async () => {
  for (const { runtime, directory } of owned.splice(0)) {
    await runtime.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

async function gateway(extraArgs: string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-runtime-"));
  const runtime = new ProxyRuntime({
    directory,
    keys: createProxyKeys(),
    command: {
      executable: process.execPath,
      args: [resolve("tests/fixtures/gateway.mjs"), ...extraArgs],
    },
  });
  owned.push({ runtime, directory });
  return { runtime, directory };
}

describe("owned gateway lifecycle", () => {
  it("serializes concurrent starts and removes transient credentials on stop", async () => {
    const { runtime, directory } = await gateway();
    const [first, second] = await Promise.all([
      runtime.start(0),
      runtime.start(0),
    ]);
    expect(first).toEqual(second);
    expect(first.phase).toBe("running");
    expect(await runtime.client().accounts()).toEqual([]);
    const config = await readFile(join(directory, "runtime.json"), "utf8");
    expect(config).toContain('"host":"127.0.0.1"');
    await runtime.stop();
    expect(runtime.status.phase).toBe("stopped");
    await expect(stat(join(directory, "runtime.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps a foreign port owner alive and reports the conflict", async () => {
    const foreign = createServer();
    await new Promise<void>((resolveReady) =>
      foreign.listen(0, "127.0.0.1", resolveReady),
    );
    try {
      const address = foreign.address();
      if (!address || typeof address === "string")
        throw new Error("Missing port");
      const { runtime } = await gateway();
      await expect(runtime.start(address.port)).rejects.toThrow(/port/i);
      expect(foreign.listening).toBe(true);
      expect(runtime.status.phase).toBe("error");
    } finally {
      await new Promise<void>((resolveClosed, reject) =>
        foreign.close((error) => (error ? reject(error) : resolveClosed())),
      );
    }
  });

  it("detects an early process exit and can be stopped safely", async () => {
    const { runtime } = await gateway(["--exit-early"]);
    await expect(runtime.start(0)).rejects.toThrow(/exit|start/i);
    expect(runtime.status.phase).toBe("error");
    await runtime.stop();
    expect(runtime.status.phase).toBe("stopped");
  });

  it("handles stop requested while starting and permits a later restart", async () => {
    const { runtime } = await gateway();
    const start = runtime.start(0);
    const stop = runtime.stop();
    await Promise.all([start, stop]);
    expect(runtime.status.phase).toBe("stopped");
    expect((await runtime.start(0)).phase).toBe("running");
  });
});
