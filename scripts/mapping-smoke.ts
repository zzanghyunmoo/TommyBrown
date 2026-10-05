import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createProxyKeys } from "../src/main/proxy/config";
import { ProxyInstaller } from "../src/main/proxy/installer";
import { compileAliases, modelAlias } from "../src/main/proxy/model-mappings";
import { ProxyRuntime } from "../src/main/proxy/runtime";
import { emptyMappings, providers } from "../src/shared/model-mappings";

const root = resolve(".local", `mapping-smoke-${randomUUID()}`);
const accountsDirectory = resolve(root, "accounts");
await mkdir(accountsDirectory, { recursive: true });
for (const provider of providers)
  await writeFile(
    resolve(accountsDirectory, `${provider}.json`),
    JSON.stringify({
      type: provider,
      email: "fixture@example.test",
      access_token: "fixture-not-a-provider-token",
      expired: "2099-01-01T00:00:00Z",
      project_id: "fixture-project",
      proxy_url: "http://127.0.0.1:1",
    }),
  );
const installer = new ProxyInstaller(
  resolve(".local", "proxy-smoke", "engine"),
);
const executable = await installer.install();
const runtime = new ProxyRuntime({
  directory: root,
  keys: createProxyKeys(),
  command: { executable },
});
try {
  await runtime.start(0);
  const client = runtime.client();
  const accounts = await client.accounts();
  assert.equal(accounts.length, 3);
  const settings = emptyMappings();
  const models = { codex: "", claude: "", antigravity: "" };
  for (const provider of providers) {
    const available = await client.accountModels(`${provider}.json`);
    const model = available[0]?.id;
    assert.ok(model, `${provider} must advertise a fixture model`);
    models[provider] = model;
  }
  settings.rows.push({
    id: randomUUID(),
    name: "Smoke mapping",
    models,
    claudeShortcut: "sonnet",
  });
  const aliases = compileAliases(settings);
  await client.setModelAliases(aliases);
  for (const provider of providers) {
    const alias = modelAlias(provider, models[provider]);
    let available: string[] = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      available = (await client.accountModels(`${provider}.json`)).map(
        (model) => model.id,
      );
      if (available.includes(alias)) break;
      await delay(100);
    }
    assert.ok(
      available.includes(models[provider]),
      "fork retains upstream model",
    );
    assert.ok(
      available.includes(alias),
      `${provider} registers its mapped alias`,
    );
    for (const other of providers.filter((candidate) => candidate !== provider))
      assert.ok(
        !available.includes(modelAlias(other, models[other])),
        "aliases do not leak between providers",
      );
    console.log(
      `${provider}: alias registered only on chosen provider; original model retained`,
    );
  }
  await runtime.stop();
  await runtime.start(0, aliases);
  for (const provider of providers) {
    const available = await runtime.client().accountModels(`${provider}.json`);
    assert.ok(
      available.some(
        (model) => model.id === modelAlias(provider, models[provider]),
      ),
    );
  }
  console.log(
    "Restart restored all three provider mappings. Synthetic credentials; no inference performed.",
  );
} finally {
  await runtime.stop();
}
