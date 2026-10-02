import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import ky from "ky";
import { ProxyClient } from "../src/main/proxy/client";
import { createProxyKeys } from "../src/main/proxy/config";
import { ProxyInstaller } from "../src/main/proxy/installer";
import { ProxyRuntime } from "../src/main/proxy/runtime";
import type { Provider } from "../src/shared/proxy";

const root = resolve(".local", "proxy-smoke");
await mkdir(root, { recursive: true });
const installer = new ProxyInstaller(resolve(root, "engine"));
const executable = await installer.install();
assert.equal(await installer.isInstalled(), true);
const keys = createProxyKeys();
const runtime = new ProxyRuntime({
  directory: resolve(root, "runtime"),
  keys,
  command: { executable },
});
try {
  const status = await runtime.start(0);
  assert.equal(status.phase, "running");
  if (status.phase !== "running") throw new Error("Gateway did not start");
  const client = new ProxyClient({ port: status.port, keys });
  assert.deepEqual(await client.accounts(), []);
  const models = await client.models();
  const unauthorized = await ky.get(
    `http://127.0.0.1:${status.port}/v1/models`,
    { throwHttpErrors: false, retry: 0, timeout: 5000 },
  );
  assert.equal(unauthorized.status, 401);
  const unauthorizedManagement = await ky.get(
    `http://127.0.0.1:${status.port}/v8/management/credentials`,
    { throwHttpErrors: false, retry: 0, timeout: 5000 },
  );
  assert.equal(unauthorizedManagement.status, 401);
  const providers: readonly Provider[] = ["claude", "codex", "antigravity"];
  for (const provider of providers) {
    const login = await client.beginLogin(provider);
    assert.equal((await client.loginStatus(login.state)).status, "wait");
    await client.cancelLogin(login.state);
    assert.equal((await client.loginStatus(login.state)).status, "error");
    console.log(
      `${provider}: authorization URL, pending state, and cancellation passed`,
    );
  }
  console.log(
    `Real CLIProxyAPI: verified installation, authenticated readiness, ${models.length} available models, and unauthorized request rejection passed`,
  );
} finally {
  await runtime.stop();
}
assert.equal(runtime.status.phase, "stopped");
console.log(
  "Owned gateway shutdown passed. No provider consent or model inference was performed.",
);
