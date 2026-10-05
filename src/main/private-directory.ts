import { execFile } from "node:child_process";
import { chmod, lstat, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { GatewayError } from "../shared/proxy";

const execute = promisify(execFile);
const protect = [
  "$ErrorActionPreference = 'Stop'",
  "$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User",
  "$acl = [System.IO.Directory]::GetAccessControl($env:TOMMYBROWN_PRIVATE_DIRECTORY, [System.Security.AccessControl.AccessControlSections]::Access)",
  "$acl.SetAccessRuleProtection($true, $false)",
  "foreach ($existing in $acl.GetAccessRules($true, $false, [System.Security.Principal.SecurityIdentifier])) { $acl.PurgeAccessRules($existing.IdentityReference) }",
  "$rule = [System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')",
  "$acl.AddAccessRule($rule)",
  "[System.IO.Directory]::SetAccessControl($env:TOMMYBROWN_PRIVATE_DIRECTORY, $acl)",
].join("\n");

export async function protectPrivateDirectory(
  directory: string,
): Promise<void> {
  const target = resolve(directory);
  if (dirname(target) === target)
    throw new GatewayError(
      "configuration",
      "An application directory must not be a filesystem root.",
    );
  await mkdir(target, { recursive: true, mode: 0o700 });
  if ((await lstat(target)).isSymbolicLink())
    throw new GatewayError(
      "configuration",
      "The application data directory must not be a symbolic link.",
    );
  if (process.platform !== "win32") {
    await chmod(target, 0o700);
    return;
  }
  try {
    await execute(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", protect],
      {
        windowsHide: true,
        timeout: 10_000,
        env: { ...process.env, TOMMYBROWN_PRIVATE_DIRECTORY: target },
      },
    );
  } catch {
    throw new GatewayError(
      "configuration",
      "Could not restrict access to the application data directory. No credentials were written.",
    );
  }
}
