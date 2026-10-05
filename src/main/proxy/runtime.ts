import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { GatewayStatus } from "../../shared/proxy";
import { GatewayError } from "../../shared/proxy";
import { ProxyClient } from "./client";
import type { ProxyKeys } from "./config";
import { createProxyConfig } from "./config";
import type { ModelAliases } from "./model-mappings";

export type GatewayOptions = {
  readonly directory: string;
  readonly keys: ProxyKeys;
  readonly command: {
    readonly executable: string;
    readonly args?: readonly string[];
  };
};

async function reservePort(preferred: number): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", () =>
      reject(
        new GatewayError(
          "runtime",
          "The gateway port is already occupied or unavailable.",
        ),
      ),
    );
    server.listen(preferred, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error || !address || typeof address === "string")
          reject(
            new GatewayError("runtime", "Could not reserve a loopback port."),
          );
        else resolve(address.port);
      });
    });
  });
}

export class ProxyRuntime {
  private current: GatewayStatus = { phase: "stopped" };
  private child: ChildProcess | undefined;
  private exited: Promise<void> = Promise.resolve();
  private queue: Promise<void> = Promise.resolve();
  private readonly configPath: string;

  constructor(private readonly options: GatewayOptions) {
    this.configPath = join(options.directory, "runtime.json");
  }

  get status(): GatewayStatus {
    return this.current;
  }

  client(): ProxyClient {
    if (this.current.phase !== "running")
      throw new GatewayError("runtime", "Start the model gateway first.");
    return new ProxyClient({
      port: this.current.port,
      keys: this.options.keys,
    });
  }

  start(preferredPort = 8317, aliases?: ModelAliases): Promise<GatewayStatus> {
    return this.serialize(async () => {
      if (this.current.phase === "running") return this.current;
      this.current = { phase: "starting" };
      try {
        const port = await reservePort(
          z.number().int().min(0).max(65535).parse(preferredPort),
        );
        const authDirectory = join(this.options.directory, "accounts");
        await mkdir(authDirectory, { recursive: true, mode: 0o700 });
        const config = createProxyConfig(
          {
            port,
            authDirectory,
            keys: this.options.keys,
          },
          aliases,
        );
        await writeFile(this.configPath, JSON.stringify(config), {
          mode: 0o600,
        });
        this.launch();
        const client = new ProxyClient({ port, keys: this.options.keys });
        await this.waitReady(client);
        const pid = this.child?.pid;
        if (!pid)
          throw new GatewayError(
            "runtime",
            "The model gateway exited during startup.",
          );
        this.current = { phase: "running", port, pid };
        return this.current;
      } catch (error) {
        await this.terminate();
        const message =
          error instanceof GatewayError
            ? error.message
            : "The model gateway could not start.";
        this.current = { phase: "error", message };
        throw new GatewayError("runtime", message);
      }
    });
  }

  stop(): Promise<void> {
    return this.serialize(async () => {
      this.current = { phase: "stopping" };
      await this.terminate();
      this.current = { phase: "stopped" };
    });
  }

  private launch(): void {
    const child = spawn(
      this.options.command.executable,
      [...(this.options.command.args ?? []), "-config", this.configPath],
      {
        cwd: this.options.directory,
        windowsHide: true,
        stdio: "ignore",
        env: { ...process.env, GIN_MODE: "release" },
      },
    );
    this.child = child;
    this.exited = new Promise<void>((resolve, reject) => {
      child.once("error", () => {
        this.current = {
          phase: "error",
          message: "The model gateway process failed to start.",
        };
      });
      child.once("close", (code) => {
        this.child = undefined;
        if (this.current.phase !== "stopping")
          this.current = {
            phase: "error",
            message: `The model gateway exited (code ${code ?? "unknown"}).`,
          };
        rm(this.configPath, { force: true }).then(resolve, reject);
      });
    });
    // Observe cleanup failures immediately; terminate() still receives the original rejection.
    void this.exited.catch((error: unknown) => {
      if (error instanceof Error)
        this.current = {
          phase: "error",
          message: "Could not remove the temporary gateway configuration.",
        };
    });
  }

  private async waitReady(client: ProxyClient): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (this.current.phase === "error")
        throw new GatewayError("runtime", this.current.message);
      try {
        await client.accounts();
        return;
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        await delay(100);
      }
    }
    throw new GatewayError(
      "runtime",
      "The model gateway did not become ready within 15 seconds.",
    );
  }

  private async terminate(): Promise<void> {
    const child = this.child;
    if (child) {
      child.kill();
      const force = setTimeout(() => child.kill("SIGKILL"), 3000);
      try {
        await this.exited;
      } finally {
        clearTimeout(force);
      }
    } else {
      await this.exited;
      await rm(this.configPath, { force: true });
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
