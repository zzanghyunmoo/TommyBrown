import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { type IPty, spawn } from "node-pty";
import { z } from "zod";
import type { LaunchProfile, LaunchRequest } from "../../shared/launch";
import {
  type TerminalBuffer,
  type TerminalEvent,
  type TerminalInfo,
  terminalInputSchema,
  terminalLaunchSchema,
  terminalResizeSchema,
} from "../../shared/terminal";
import type { WorkspaceStore } from "../workspace/store";
import { powerShellProfile } from "./powershell";
import { resolveCli } from "./resolve-cli";

type Session = {
  info: TerminalInfo;
  readonly pty: IPty;
  buffer: string;
  sequence: number;
  readonly exited: Promise<void>;
  closing?: Promise<void>;
};

type TerminalProfiles = {
  readonly model: (request: LaunchRequest) => Promise<LaunchProfile>;
  readonly shell?: () => Promise<LaunchProfile>;
  readonly connectors?: (
    cli: LaunchRequest["cli"],
    ids: readonly string[],
  ) => Pick<LaunchProfile, "args" | "environment">;
};

export class TerminalService {
  private readonly sessions = new Map<string, Session>();
  private launching = 0;
  private stopping = false;
  constructor(
    private readonly spaces: WorkspaceStore,
    private readonly profiles: TerminalProfiles,
    private readonly emit: (event: TerminalEvent) => void,
  ) {}

  async launch(input: unknown): Promise<TerminalInfo> {
    if (this.stopping) throw new Error("The application is shutting down.");
    const request = terminalLaunchSchema.parse(input);
    if (process.platform !== "win32")
      throw new Error("Interactive terminals currently support Windows.");
    if (request.cli === "powershell" && request.connectors.length)
      throw new Error("Choose a coding CLI to use connectors.");
    if (this.sessions.size + this.launching >= 16)
      throw new Error("Close a terminal before opening another (limit 16).");
    this.launching++;
    try {
      const space = this.spaces.requireSpace(request.spaceId);
      if (!(await stat(space.root)).isDirectory())
        throw new Error("This space's directory is unavailable.");
      const profile =
        request.cli === "powershell"
          ? await (this.profiles.shell?.() ?? powerShellProfile())
          : request.model === null
            ? { executable: request.cli, args: [], environment: {} }
            : await this.profiles.model({
                cli: request.cli,
                model: request.model,
                mappingRevision: request.mappingRevision,
              });
      const connectorProfile =
        request.cli === "powershell"
          ? { args: [], environment: {} }
          : (this.profiles.connectors?.(request.cli, request.connectors) ?? {
              args: [],
              environment: {},
            });
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env))
        if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE")
          env[key] = value;
      for (const [key, value] of Object.entries({
        ...profile?.environment,
        ...connectorProfile.environment,
      })) {
        for (const existing of Object.keys(env))
          if (existing.toLowerCase() === key.toLowerCase())
            delete env[existing];
        if (value === null) delete env[key];
        else env[key] = value;
      }
      for (const key of Object.keys(env))
        if (
          ["no_color", "term", "colorterm", "force_color", "clicolor"].includes(
            key.toLowerCase(),
          )
        )
          delete env[key];
      Object.assign(env, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        FORCE_COLOR: "3",
        CLICOLOR: "1",
      });
      let executable = "powershell.exe";
      let args = [...(profile?.args ?? ["-NoLogo", "-NoProfile"])];
      if (profile && request.cli !== "powershell") {
        const target = await resolveCli(request.cli);
        executable = target.executable;
        args = [...target.args, ...profile.args, ...connectorProfile.args];
        if (args.join(" ").length > 24000)
          throw new Error(
            "This CLI configuration is too large. Select fewer connectors.",
          );
      }
      if (this.stopping) throw new Error("The application is shutting down.");
      const pty = spawn(executable, args, {
        name: "xterm-256color",
        cols: 90,
        rows: 28,
        cwd: space.root,
        env,
        useConpty: true,
      });
      const id = randomUUID();
      const info: TerminalInfo = {
        ...request,
        id,
        phase: "running",
        exitCode: null,
      };
      let finish: () => void = () => undefined;
      const exited = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const session: Session = { info, pty, buffer: "", sequence: 0, exited };
      this.sessions.set(id, session);
      pty.onData((data) => {
        session.sequence++;
        session.buffer = (session.buffer + data).slice(-1024 * 1024);
        this.emit({ type: "data", id, data, sequence: session.sequence });
      });
      pty.onExit(({ exitCode }) => {
        session.info = { ...session.info, phase: "exited", exitCode };
        this.emit({ type: "exit", id, exitCode });
        finish();
      });
      return { ...info };
    } finally {
      this.launching--;
    }
  }

  list(): readonly TerminalInfo[] {
    return [...this.sessions.values()].map((session) => ({ ...session.info }));
  }
  attach(id: string): TerminalBuffer {
    const session = this.require(id);
    return {
      id,
      phase: session.info.phase,
      data: session.buffer,
      sequence: session.sequence,
    };
  }
  write(input: unknown): void {
    const request = terminalInputSchema.parse(input);
    const session = this.require(request.id);
    if (session.info.phase !== "running")
      throw new Error("This terminal has exited.");
    session.pty.write(request.data);
  }
  resize(input: unknown): void {
    const request = terminalResizeSchema.parse(input);
    const session = this.require(request.id);
    if (session.info.phase === "running")
      session.pty.resize(request.columns, request.rows);
  }
  async close(id: string): Promise<void> {
    const session = this.require(id);
    if (!session.closing)
      session.closing = this.closeSession(session).finally(() => {
        delete session.closing;
      });
    await session.closing;
  }
  async stop(): Promise<void> {
    this.stopping = true;
    await Promise.all([...this.sessions.keys()].map((id) => this.close(id)));
  }
  async disconnectConnector(id: string): Promise<void> {
    await Promise.all(
      [...this.sessions.values()]
        .filter((session) => session.info.connectors.includes(id))
        .map((session) => this.close(session.info.id)),
    );
  }
  private async closeSession(session: Session): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (session.info.phase === "running") session.pty.kill();
      await Promise.race([
        session.exited,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error("The terminal did not exit. Try closing it again."),
              ),
            5000,
          );
        }),
      ]);
      this.sessions.delete(session.info.id);
      this.emit({ type: "closed", id: session.info.id });
    } finally {
      clearTimeout(timer);
    }
  }
  private require(input: string): Session {
    const id = z.uuid().parse(input);
    const session = this.sessions.get(id);
    if (!session) throw new Error("This terminal is no longer available.");
    return session;
  }
}
