import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { protectPrivateDirectory } from "../private-directory";

type MemoryRuntime = {
  readonly directory: string;
  readonly executable: string;
  readonly script: string;
};

export class MemoryConnector {
  private readonly queues = new Map<string, Promise<void>>();
  private ready: Promise<void> | undefined;

  constructor(private readonly runtime: MemoryRuntime) {}

  async withClient<T>(
    id: string,
    action: (client: Client) => Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    const name = z.uuid().parse(id);
    const previous = this.queues.get(name) ?? Promise.resolve();
    const operation = previous.then(async () => {
      signal.throwIfAborted();
      this.ready ??= protectPrivateDirectory(this.runtime.directory).catch(
        (error: unknown) => {
          this.ready = undefined;
          throw error;
        },
      );
      await this.ready;
      signal.throwIfAborted();
      const transport = new StdioClientTransport({
        command: this.runtime.executable,
        args: [this.runtime.script],
        env: {
          ELECTRON_RUN_AS_NODE: "1",
          MEMORY_FILE_PATH: join(this.runtime.directory, `${name}.jsonl`),
        },
        stderr: "ignore",
      });
      const client = new Client({ name: "TommyBrown", version: "0.1.0" });
      const abort = () => {
        void client.close().catch((error: unknown) => {
          if (!(error instanceof Error)) throw error;
          console.warn("The local Memory process could not be closed.");
        });
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        signal.throwIfAborted();
        await client.connect(transport, { timeout: 15000, signal });
        return await action(client);
      } finally {
        signal.removeEventListener("abort", abort);
        await client.close();
      }
    });
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(name, settled);
    try {
      return await operation;
    } finally {
      if (this.queues.get(name) === settled) this.queues.delete(name);
    }
  }
}
