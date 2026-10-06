import { homedir } from "node:os";
import { expect, it } from "vitest";
import { runProcess } from "../../src/main/agents/process";

it("captures bounded output and propagates real nonzero exit", async () => {
  const options = {
    cwd: homedir(),
    signal: new AbortController().signal,
    timeout: 5000,
  };
  expect(
    await runProcess(
      process.execPath,
      ["-e", "console.log('x'.repeat(20000))"],
      options,
    ),
  ).toHaveLength(15999);
  await expect(
    runProcess(
      process.execPath,
      ["-e", "console.error('download denied'); process.exit(7)"],
      options,
    ),
  ).rejects.toThrow("download denied");
});

it("times out a real child and cancels a process with descendants", async () => {
  const controller = new AbortController();
  await expect(
    runProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      cwd: homedir(),
      signal: controller.signal,
      timeout: 150,
    }),
  ).rejects.toThrow("시간");
  let descendant = 0;
  const running = runProcess(
    process.execPath,
    [
      "-e",
      "const {spawn}=require('node:child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(c.pid); setInterval(()=>{},1000)",
    ],
    {
      cwd: homedir(),
      signal: controller.signal,
      timeout: 5000,
      log: (text) => {
        descendant = Number(text.trim());
        controller.abort();
      },
    },
  );
  await expect(running).rejects.toThrow("취소");
  expect(descendant).toBeGreaterThan(0);
  await expect
    .poll(() => {
      try {
        process.kill(descendant, 0);
        return true;
      } catch {
        return false;
      }
    })
    .toBe(false);
});
