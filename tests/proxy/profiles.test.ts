import { describe, expect, it } from "vitest";
import {
  createLaunchProfile,
  powershellLaunch,
} from "../../src/main/proxy/profiles";

describe("per-launch CLI routing", () => {
  it("sends Claude Code to the local gateway and clears conflicting auth backends", () => {
    const profile = createLaunchProfile(
      { cli: "claude", model: "gpt-test" },
      { port: 8317, key: "client-test-key" },
    );
    expect(profile.executable).toBe("claude");
    expect(profile.args).toEqual(["--model", "gpt-test"]);
    expect(profile.environment["ANTHROPIC_BASE_URL"]).toBe(
      "http://127.0.0.1:8317",
    );
    expect(profile.environment["ANTHROPIC_AUTH_TOKEN"]).toBe("client-test-key");
    expect(profile.environment["ANTHROPIC_API_KEY"]).toBe(null);
    expect(profile.environment["CLAUDE_CODE_USE_BEDROCK"]).toBe(null);
  });

  it("uses a named Codex Responses provider without rewriting config files", () => {
    const profile = createLaunchProfile(
      { cli: "codex", model: "claude-test" },
      { port: 18317, key: "client-test-key" },
    );
    expect(profile.executable).toBe("codex");
    expect(profile.args).toContain('model_provider="tommybrown"');
    expect(profile.args).toContain(
      'model_providers.tommybrown.base_url="http://127.0.0.1:18317/v1"',
    );
    expect(profile.args).toContain(
      'model_providers.tommybrown.wire_api="responses"',
    );
    expect(profile.args).toContain(
      "model_providers.tommybrown.requires_openai_auth=false",
    );
    expect(profile.environment["TOMMYBROWN_API_KEY"]).toBe("client-test-key");
  });

  it("restores the caller environment and quotes literal shell metacharacters", () => {
    const text = powershellLaunch({
      executable: "claude",
      args: ["--model", "model'$(whoami)"],
      environment: { TEST_VALUE: "key'$(whoami)" },
    });
    expect(text).toContain("finally");
    expect(text).toContain("'model''$(whoami)'");
    expect(text).toContain("'key''$(whoami)'");
    expect(text).toContain("[Environment]::GetEnvironmentVariable");
    expect(text).toContain("[Environment]::SetEnvironmentVariable");
  });

  it("rejects invalid model IDs and ports before producing a command", () => {
    expect(() =>
      createLaunchProfile(
        { cli: "claude", model: "model\n; whoami" },
        { port: 8317, key: "key" },
      ),
    ).toThrow();
    expect(() =>
      createLaunchProfile(
        { cli: "codex", model: "valid" },
        { port: -1, key: "key" },
      ),
    ).toThrow();
  });
});
