---
title: Windows private directory protection must survive restart
date: 2026-10-03
category: security-issues
module: Private application storage
problem_type: security_issue
component: authentication
symptoms:
  - "The first desktop launch succeeds but reopening produces no application window."
  - "Repeated Set-Acl reports a missing SeSecurityPrivilege privilege."
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [windows, acl, credentials, electron, restart]
---

# Windows private directory protection must survive restart

## Problem

Protecting the credential directory with a fresh security descriptor and `Set-Acl`
worked during initial setup but failed on a later launch. The native startup error
dialog also prevented the automated test from reporting the underlying failure promptly.
This fix is present on the development branch; it is not a released application.

## Symptoms

- Real engine installation, start, and stop passed, then the restart test timed out.
- Reapplying the original ACL command reported missing `SeSecurityPrivilege`.

## What Didn't Work

A test that only protected a newly created directory passed. It did not cover repeated
setup, which occurs whenever the desktop application starts.

## Solution

[The private-directory helper](../../../src/main/private-directory.ts) reads only
`AccessControlSections.Access`, disables inherited access rules, removes existing
explicit rules, grants the current Windows identity full inherited access, and writes
that DACL with `Directory.SetAccessControl`. It does not request audit-policy changes.
The path is passed through a dedicated environment variable, never interpolated into
PowerShell source. Symlink directories and filesystem roots are rejected.

[The regression test](../../../tests/proxy/private-directory.test.ts) protects the
same directory twice, then checks the directory and a new credential file for exactly
the expected current-user rule. The actual desktop restart test also passes.

## Why This Works

Credential access needs a discretionary access control list. Restricting the operation
to that section avoids the broader security-descriptor update that triggered the
privilege error. POSIX mode bits alone do not express the Windows access policy.

## Prevention

Exercise repeated setup and a real application restart when changing credential
storage. Test ordinary user permissions, not just elevated administrative execution.
Keep startup errors observable in automated tests instead of blocking on a native dialog.

## Related Issues

- [Checkpoint evidence](../../verification/2026-10-03-model-access.md)
- [Microsoft Set-Acl documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-acl)
