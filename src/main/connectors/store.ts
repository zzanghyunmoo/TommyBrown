import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { z } from "zod";
import { type Connector, connectorInputSchema } from "../../shared/connectors";

const recordSchema = connectorInputSchema.extend({ id: z.uuid() });
const stateSchema = z.object({
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
    let state: State = { version: 1, connectors: [] };
    try {
      state = stateSchema.parse(
        JSON.parse(codec.decrypt(await readFile(path))),
      );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    return new ConnectorStore(path, codec, state);
  }
  list(): readonly Connector[] {
    return this.state.connectors.map(({ token, ...connector }) => ({
      ...connector,
      hasToken: token !== null,
    }));
  }
  require(input: unknown): z.infer<typeof recordSchema> {
    const id = z.uuid().parse(input);
    const connector = this.state.connectors.find((item) => item.id === id);
    if (!connector) throw new Error("This connector is no longer available.");
    return { ...connector };
  }
  add(input: unknown): Promise<readonly Connector[]> {
    const record = { ...connectorInputSchema.parse(input), id: randomUUID() };
    return this.mutate((state) => ({
      ...state,
      connectors: [...state.connectors, record],
    }));
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
