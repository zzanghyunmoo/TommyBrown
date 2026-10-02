import { describe, expect, it } from "vitest";
import {
  createProxyConfig,
  createProxyKeys,
} from "../../src/main/proxy/config";

describe("private loopback gateway configuration", () => {
  it("restricts management and uses separate unpredictable client credentials", () => {
    const keys = createProxyKeys();
    const config = createProxyConfig({
      port: 18317,
      authDirectory: "C:/test/accounts",
      keys,
    });
    expect(keys.client).not.toEqual(keys.management);
    expect(keys.client.length).toBeGreaterThanOrEqual(40);
    expect(config.server).toMatchObject({ host: "127.0.0.1", port: 18317 });
    expect(config.management).toMatchObject({
      "allow-remote": false,
      "disable-control-panel": true,
    });
    expect(config.access["api-keys"]).toEqual([keys.client]);
    expect(config.oauth["auth-dir"]).toBe("C:/test/accounts");
    expect(config.plugins.enabled).toBe(false);
  });

  it("rejects invalid ports and empty credentials before launching a process", () => {
    expect(() =>
      createProxyConfig({
        port: 0,
        authDirectory: "accounts",
        keys: createProxyKeys(),
      }),
    ).toThrow();
    expect(() =>
      createProxyConfig({
        port: 65536,
        authDirectory: "accounts",
        keys: createProxyKeys(),
      }),
    ).toThrow();
    expect(() =>
      createProxyConfig({
        port: 8317,
        authDirectory: "",
        keys: createProxyKeys(),
      }),
    ).toThrow();
  });
});
