import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ModelAliases } from "./model-mappings";

export const proxyKeysSchema = z.object({
  client: z.string().min(32),
  management: z.string().min(32),
});
export type ProxyKeys = z.infer<typeof proxyKeysSchema>;
const configInput = z.object({
  port: z.number().int().min(1).max(65535),
  authDirectory: z.string().min(1),
  keys: proxyKeysSchema,
});

export function createProxyKeys(): ProxyKeys {
  return {
    client: randomBytes(32).toString("hex"),
    management: randomBytes(32).toString("hex"),
  };
}

export function createProxyConfig(
  input: z.infer<typeof configInput>,
  aliases?: ModelAliases,
) {
  const { port, authDirectory, keys } = configInput.parse(input);
  return {
    "config-version": 8,
    server: {
      host: "127.0.0.1",
      port,
      "trusted-proxies": [],
      discovery: { enabled: false },
    },
    management: {
      "allow-remote": false,
      "secret-key": keys.management,
      "disable-control-panel": true,
      "disable-auto-update-panel": true,
    },
    access: { "api-keys": [keys.client] },
    oauth: {
      "auth-dir": authDirectory,
      ...(aliases ? { "model-alias": aliases } : {}),
    },
    plugins: { enabled: false },
    routing: { retry: { "request-retry": 0 } },
    observability: {
      logs: { debug: false, "logging-to-file": false, "request-log": false },
    },
  };
}
