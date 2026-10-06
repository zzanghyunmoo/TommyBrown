import type { LaunchProfile } from "../../shared/launch";

export function powerShellProfile(
  environment: LaunchProfile["environment"] = {},
  commands: readonly string[] = [],
): LaunchProfile {
  const bootstrap = [
    "function global:prompt { Write-Host ('PS ' + (Get-Location).Path) -ForegroundColor Cyan -NoNewline; return '> ' }",
    "if (Get-Module -ListAvailable PSReadLine) { Import-Module PSReadLine; Set-PSReadLineOption -Colors @{ Command='Cyan'; Parameter='Yellow'; String='Green'; Variable='Magenta'; Number='Cyan'; Operator='Yellow'; Comment='DarkGray' } }",
    ...commands,
  ];
  return {
    executable: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NoExit",
      "-Command",
      bootstrap.join("; "),
    ],
    environment,
  };
}
