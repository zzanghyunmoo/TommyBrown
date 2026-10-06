import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import {
  OAuthClientInformationFullSchema,
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { z } from "zod";
import {
  type Connector,
  connectorInputSchema,
  connectorToolPolicySchema,
  isMcpConnector,
  isServiceConnector,
  serviceInputSchema,
  servicePresets,
} from "../../shared/connectors";

const oauthSchema = z.object({
  client: z
    .union([OAuthClientInformationFullSchema, OAuthClientInformationSchema])
    .nullable(),
  tokens: OAuthTokensSchema.nullable(),
  expiresAt: z.number().nullable(),
});
export type SavedOAuth = z.infer<typeof oauthSchema>;
const recordSchema = connectorInputSchema.extend({
  id: z.uuid(),
  allowedTools: connectorToolPolicySchema.shape.allowedTools.default(null),
  oauth: oauthSchema.nullable().default(null),
});
const stateSchema = z.object({
  version: z.literal(2),
  connectors: z.array(recordSchema).max(64),
});
const legacySchema = z.object({
  version: z.literal(1),
  connectors: z.array(recordSchema).max(32),
});
type State = z.infer<typeof stateSchema>;
export type SecretCodec = {
  readonly encrypt: (value: string) => Buffer;
  readonly decrypt: (value: Buffer) => string;
};

export class ConnectorStore {
  private queue: Promise<void> = Promise.resolve();
  private constructor(
    private readonly path: string,
    private readonly codec: SecretCodec,
    private state: State,
  ) {}
  static async open(path: string, codec: SecretCodec): Promise<ConnectorStore> {
    let state: State = { version: 2, connectors: [] };
    let migrated = false;
    try {
      const stored: unknown = JSON.parse(codec.decrypt(await readFile(path)));
      const legacy = legacySchema.safeParse(stored);
      if (legacy.success) {
        const records: z.infer<typeof recordSchema>[] = [];
        for (const record of legacy.data.connectors) {
          if (
            record.kind === "memory" ||
            (record.kind === "context7" && record.endpoint)
          ) {
            records.push({ ...record, webUrl: null });
          } else if (record.endpoint) {
            records.push({
              ...record,
              endpoint: null,
              token: null,
              allowedTools: null,
            });
            records.push({
              ...record,
              id: randomUUID(),
              kind: "mcp",
              webUrl: null,
            });
          } else {
            records.push({
              ...record,
              kind: record.kind === "context7" ? "browser" : record.kind,
            });
          }
        }
        state = stateSchema.parse({ version: 2, connectors: records });
        migrated = true;
      } else state = stateSchema.parse(stored);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    const store = new ConnectorStore(path, codec, state);
    if (migrated) await store.mutate((current) => current);
    return store;
  }
  list(): readonly Connector[] {
    return this.state.connectors.map(({ token, oauth, ...connector }) => ({
      ...connector,
      hasToken: token !== null,
      authenticated: oauth?.tokens !== null && oauth?.tokens !== undefined,
    }));
  }
  require(input: unknown): z.infer<typeof recordSchema> {
    const id = z.uuid().parse(input);
    const connector = this.state.connectors.find((item) => item.id === id);
    if (!connector) throw new Error("This connector is no longer available.");
    return { ...connector };
  }
  add(input: unknown): Promise<readonly Connector[]> {
    const record = recordSchema.parse({
      ...connectorInputSchema.parse(input),
      id: randomUUID(),
    });
    if (isServiceConnector(record))
      throw new Error("Use service registration for OAuth connectors.");
    if (
      record.kind === "memory" &&
      (record.endpoint !== null || record.token !== null)
    )
      throw new Error("Local Memory does not use an endpoint or token.");
    if (isMcpConnector(record)) {
      if (record.webUrl !== null)
        throw new Error("MCP servers do not use web login URLs.");
      if (record.kind !== "memory" && !record.endpoint)
        throw new Error("An HTTP MCP server requires an endpoint.");
    } else if (
      !record.webUrl ||
      record.endpoint !== null ||
      record.token !== null
    ) {
      throw new Error(
        "Web connectors require a web URL and cannot contain MCP credentials.",
      );
    }
    return this.mutate((state) => ({
      ...state,
      connectors: [...state.connectors, record],
    }));
  }
  addService(input: unknown): Promise<readonly Connector[]> {
    const request = serviceInputSchema.parse(input);
    const preset = servicePresets.find((item) => item.kind === request.kind);
    if (!preset) throw new Error("Unknown service.");
    const record = recordSchema.parse({
      id: randomUUID(),
      kind: preset.kind,
      name: request.name,
      webUrl: null,
      endpoint: preset.endpoint,
      token: null,
      allowedTools: [],
      oauth: {
        client: request.clientId
          ? {
              client_id: request.clientId,
              client_secret: request.clientSecret,
              issuer: preset.issuer,
            }
          : null,
        tokens: null,
        expiresAt: null,
      },
    });
    return this.mutate((state) => ({
      ...state,
      connectors: [...state.connectors, record],
    }));
  }
  updateOAuth(
    id: string,
    change: (current: SavedOAuth) => SavedOAuth,
  ): Promise<readonly Connector[]> {
    return this.mutate((state) => {
      const record = this.require(id);
      if (!isServiceConnector(record) || !record.oauth)
        throw new Error(
          "This connection does not support service authentication.",
        );
      const oauth = oauthSchema.parse(change(record.oauth));
      return {
        ...state,
        connectors: state.connectors.map((item) =>
          item.id === id ? { ...item, oauth } : item,
        ),
      };
    });
  }
  setTools(input: unknown): Promise<readonly Connector[]> {
    const policy = connectorToolPolicySchema.parse(input);
    return this.mutate((state) => {
      if (!isMcpConnector(this.require(policy.id)))
        throw new Error("Web connectors do not have MCP tool permissions.");
      return {
        ...state,
        connectors: state.connectors.map((connector) =>
          connector.id === policy.id
            ? {
                ...connector,
                allowedTools:
                  policy.allowedTools === null
                    ? null
                    : [...new Set(policy.allowedTools)],
              }
            : connector,
        ),
      };
    });
  }
  remove(id: string): Promise<readonly Connector[]> {
    return this.mutate((state) => {
      this.require(id);
      return {
        ...state,
        connectors: state.connectors.filter((item) => item.id !== id),
      };
    });
  }
  private mutate(
    change: (state: State) => State,
  ): Promise<readonly Connector[]> {
    const operation = this.queue.then(async () => {
      const next = stateSchema.parse(change(this.state));
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, this.codec.encrypt(JSON.stringify(next)), {
          mode: 0o600,
          flag: "wx",
        });
        await rename(temporary, this.path);
      } finally {
        await rm(temporary, { force: true });
      }
      this.state = next;
      return this.list();
    });
    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}
