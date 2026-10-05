import { z } from "zod";
import type { LaunchProfile, LaunchRequest } from "../../shared/launch";
import { launchRequestSchema } from "../../shared/launch";

const gatewaySchema = z.object({
  port: z.number().int().min(1).max(65535),
  key: z.string().min(1),
});

export function createLaunchProfile(
  request: LaunchRequest,
  gateway: z.infer<typeof gatewaySchema>,
): LaunchProfile {
  const { cli, model } = launchRequestSchema.parse(request);
  const { port, key } = gatewaySchema.parse(gateway);
  const base = `http://127.0.0.1:${port}`;
  if (cli === "claude")
    return {
      executable: "claude",
      args: ["--model", model],
      environment: {
        ANTHROPIC_BASE_URL: base,
        ANTHROPIC_AUTH_TOKEN: key,
        ANTHROPIC_MODEL: model,
        ANTHROPIC_API_KEY: null,
        CLAUDE_CODE_USE_BEDROCK: null,
        CLAUDE_CODE_USE_VERTEX: null,
        CLAUDE_CODE_USE_FOUNDRY: null,
        ANTHROPIC_DEFAULT_OPUS_MODEL: model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
        CLAUDE_CODE_SUBAGENT_MODEL: model,
      },
    };
  return {
    executable: "codex",
    args: [
      "-m",
      model,
      "-c",
      'model_provider="tommybrown"',
      "-c",
      'model_providers.tommybrown.name="TommyBrown"',
      "-c",
      `model_providers.tommybrown.base_url=${JSON.stringify(`${base}/v1`)}`,
      "-c",
      'model_providers.tommybrown.env_key="TOMMYBROWN_API_KEY"',
      "-c",
      'model_providers.tommybrown.wire_api="responses"',
      "-c",
      "model_providers.tommybrown.requires_openai_auth=false",
    ],
    environment: { TOMMYBROWN_API_KEY: key },
  };
}

export function powershellLaunch(profile: LaunchProfile): string {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const entries = Object.entries(profile.environment);
  const save = entries.map(
    ([name]) =>
      `  $tbPrevious[${quote(name)}] = [Environment]::GetEnvironmentVariable(${quote(name)}, 'Process')`,
  );
  const set = entries.map(
    ([name, value]) =>
      `    [Environment]::SetEnvironmentVariable(${quote(name)}, ${value === null ? "$null" : quote(value)}, 'Process')`,
  );
  const restore = entries.map(
    ([name]) =>
      `    [Environment]::SetEnvironmentVariable(${quote(name)}, $tbPrevious[${quote(name)}], 'Process')`,
  );
  const command = [profile.executable, ...profile.args].map(quote).join(" ");
  return [
    "& {",
    "  $tbPrevious = @{}",
    ...save,
    "  try {",
    ...set,
    `    & ${command}`,
    "  } finally {",
    ...restore,
    "  }",
    "}",
  ].join("\n");
}
