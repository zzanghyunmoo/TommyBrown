import { spawn } from "node:child_process";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

export function cleanOutput(text: string): string {
  return stripVTControlCharacters(text).replaceAll("\r", "").slice(-16_000);
}

export function runProcess(
  executable: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly signal: AbortSignal;
    readonly timeout: number;
    readonly env?: NodeJS.ProcessEnv;
    readonly log?: (text: string) => void;
  },
): Promise<string> {
  options.signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let failure: Error | undefined;
    let killing: Promise<void> | undefined;
    const terminate = (message: string) => {
      if (killing) return;
      failure = new Error(message);
      const pid = child.pid;
      if (!pid) return;
      killing = new Promise<void>((done) => {
        if (process.platform === "win32") {
          const killer = spawn(
            join(
              process.env["SystemRoot"] ?? "C:\\Windows",
              "System32",
              "taskkill.exe",
            ),
            ["/PID", String(pid), "/T", "/F"],
            { windowsHide: true, stdio: "ignore" },
          );
          killer.once("error", () => {
            child.kill();
            done();
          });
          killer.once("close", () => {
            child.kill();
            done();
          });
        } else {
          try {
            process.kill(-pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
          done();
        }
      });
    };
    const abort = () => terminate("설치를 취소했습니다.");
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) abort();
    const timer = setTimeout(
      () =>
        terminate(
          "실행 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도하세요.",
        ),
      options.timeout,
    );
    const receive = (text: string) => {
      output = cleanOutput(output + text);
      options.log?.(cleanOutput(text));
    };
    child.stdout.setEncoding("utf8").on("data", receive);
    child.stderr.setEncoding("utf8").on("data", receive);
    child.once("error", (error) => {
      failure = error;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      options.signal.removeEventListener("abort", abort);
      void (killing ?? Promise.resolve()).then(() => {
        if (failure) reject(failure);
        else if (code !== 0)
          reject(
            new Error(`실행 실패 (종료 코드 ${code}): ${output.slice(-2000)}`),
          );
        else resolve(output.trim());
      });
    });
  });
}
