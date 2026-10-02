import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { protectPrivateDirectory } from "../../src/main/private-directory";

it.skipIf(process.platform !== "win32")(
  "restricts Windows credentials to the current user and propagates to new files",
  async () => {
    const base = resolve(".local");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(join(base, "acl-test-"));
    const target = join(directory, "quoted' [directory]");
    try {
      await protectPrivateDirectory(target);
      await writeFile(join(target, "credential.fixture"), "not-a-secret");
      await protectPrivateDirectory(target);
      const verify = [
        "$ErrorActionPreference = 'Stop'",
        "$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
        "$acl = Get-Acl -LiteralPath $env:TOMMYBROWN_PRIVATE_DIRECTORY",
        "if (!$acl.AreAccessRulesProtected) { throw 'Directory inheritance was not disabled' }",
        "$rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])",
        "if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $me) { throw 'Unexpected directory access' }",
        "$child = Get-Acl -LiteralPath (Join-Path $env:TOMMYBROWN_PRIVATE_DIRECTORY 'credential.fixture')",
        "$childRules = $child.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])",
        "if ($childRules.Count -ne 1 -or $childRules[0].IdentityReference.Value -ne $me) { throw 'Unexpected credential access' }",
        "Write-Output 'private-access-verified'",
      ].join("\n");
      const result = await promisify(execFile)(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", verify],
        {
          windowsHide: true,
          timeout: 10_000,
          env: { ...process.env, TOMMYBROWN_PRIVATE_DIRECTORY: target },
        },
      );
      expect(result.stdout.trim()).toBe("private-access-verified");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  15_000,
);
