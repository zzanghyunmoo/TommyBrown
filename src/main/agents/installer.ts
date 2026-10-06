import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Provider } from "../../shared/proxy";
import { desktopPath } from "../terminal/posix";
import { CliNotFoundError, resolveCli } from "../terminal/resolve-cli";
import { runProcess } from "./process";

const origins: Record<Provider, string> = {
  codex: "https://chatgpt.com/codex",
  claude: "https://claude.ai",
  antigravity: "https://antigravity.google/cli",
};

export async function probeAgent(id: Provider, signal: AbortSignal) {
  let command: Awaited<ReturnType<typeof resolveCli>>;
  try {
    command = await resolveCli(id);
  } catch (error) {
    if (
      error instanceof CliNotFoundError &&
      error.command === (id === "antigravity" ? "agy" : id)
    )
      return null;
    throw error;
  }
  const version = await runProcess(
    command.executable,
    [...command.args, "--version"],
    {
      cwd: homedir(),
      signal,
      timeout: 10_000,
    },
  );
  if (!version) throw new Error("기존 CLI가 버전 정보를 반환하지 않았습니다.");
  return {
    path: command.executable,
    version: version.split("\n").at(-1) ?? version,
  };
}

export async function installAgent(
  id: Provider,
  signal: AbortSignal,
  log: (text: string) => void,
): Promise<void> {
  const windows = process.platform === "win32";
  if (
    (!windows && process.platform !== "darwin") ||
    !["x64", "arm64"].includes(process.arch)
  )
    throw new Error("이 OS 또는 CPU에서는 자동 설치를 지원하지 않습니다.");
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-agent-"));
  try {
    const url = `${origins[id]}/install.${windows ? "ps1" : "sh"}`;
    log(`공식 설치 프로그램 다운로드: ${url}\n`);
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    });
    if (!response.ok || !response.body)
      throw new Error(`설치 프로그램 다운로드 실패: HTTP ${response.status}`);
    if (response.headers.get("content-type")?.includes("text/html"))
      throw new Error("설치 프로그램 대신 HTML 응답을 받았습니다.");
    if (new URL(response.url).protocol !== "https:")
      throw new Error("설치 프로그램은 HTTPS로만 다운로드할 수 있습니다.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1_000_000)
          throw new Error("설치 프로그램 크기 제한을 초과했습니다.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    signal.throwIfAborted();
    const script = join(directory, windows ? "install.ps1" : "install.sh");
    await writeFile(script, Buffer.concat(chunks), { mode: 0o600 });
    const executable = windows
      ? join(
          process.env["SystemRoot"] ?? "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        )
      : "/bin/bash";
    const args = windows
      ? [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          script,
        ]
      : [script];
    if (id === "antigravity" && windows)
      args.push("--skip-aliases", "--skip-path");
    log("공식 설치 프로그램 실행 중…\n");
    await runProcess(executable, args, {
      cwd: directory,
      signal,
      timeout: 10 * 60_000,
      log,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !windows || key.toUpperCase() !== "PSMODULEPATH",
          ),
        ),
        CODEX_NON_INTERACTIVE: "1",
        ...(windows ? {} : { PATH: desktopPath() }),
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
