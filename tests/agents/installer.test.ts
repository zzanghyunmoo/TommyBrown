import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { installAgent } from "../../src/main/agents/installer";

it.skipIf(process.platform !== "win32")(
  "native installer can verify hashes when launched from PowerShell 7",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "tommybrown-pwsh7-"));
    const module = join(directory, "Microsoft.PowerShell.Utility");
    await mkdir(module);
    await writeFile(
      join(module, "Microsoft.PowerShell.Utility.psd1"),
      "@{ RootModule='Hash.psm1'; ModuleVersion='99.0.0'; GUID='bfca3588-f376-4a42-9914-50d6fda1e6e7'; PowerShellVersion='7.0'; FunctionsToExport=@('Get-FileHash') }",
    );
    await writeFile(
      join(module, "Hash.psm1"),
      "function Get-FileHash { throw 'Incompatible module selected' }",
    );
    const response = new Response(
      [
        "$ErrorActionPreference = 'Stop'",
        "$hash = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash",
        "if ($hash.Length -ne 64) { throw 'Invalid SHA256' }",
        "Write-Output 'checksum-command-ready'",
      ].join("\n"),
      { headers: { "content-type": "text/plain" } },
    );
    vi.spyOn(response, "url", "get").mockReturnValue(
      "https://chatgpt.com/codex/install.ps1",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    vi.stubEnv(
      Object.keys(process.env).find(
        (key) => key.toUpperCase() === "PSMODULEPATH",
      ) ?? "PSModulePath",
      [
        directory,
        join(
          process.env["SystemRoot"] ?? "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "Modules",
        ),
      ].join(";"),
    );
    let output = "";
    try {
      await installAgent("codex", new AbortController().signal, (text) => {
        output += text;
      });
      expect(output).toContain("checksum-command-ready");
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  },
  15_000,
);
