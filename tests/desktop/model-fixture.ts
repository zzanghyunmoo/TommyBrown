import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROXY_VERSION, ProxyInstaller } from "../../src/main/proxy/installer";
import { providers } from "../../src/shared/model-mappings";

export async function prepareModelFixture(directory: string) {
  await new ProxyInstaller(
    resolve(directory, "engine", PROXY_VERSION),
  ).install();
  const accounts = resolve(directory, "gateway", "accounts");
  await mkdir(accounts, { recursive: true });
  for (const provider of providers)
    await writeFile(
      resolve(accounts, `${provider}.json`),
      JSON.stringify({
        type: provider,
        email: "fixture@example.test",
        access_token: "fixture-not-a-provider-token",
        expired: "2099-01-01T00:00:00Z",
        project_id: "fixture-project",
        proxy_url: "http://127.0.0.1:1",
      }),
    );
}
