import { z } from "zod";
import { mappingRevisionSchema } from "./launch";

export const terminalLaunchSchema = z
  .object({
    spaceId: z.uuid(),
    cli: z.enum(["powershell", "claude", "codex", "antigravity"]),
    model: z.string().min(1).max(200).nullable(),
    mappingRevision: mappingRevisionSchema.optional(),
    connectors: z.array(z.uuid()).max(16).default([]),
  })
  .refine(
    (request) => request.cli !== "powershell" || request.model === null,
    "Choose a coding CLI for a routed model.",
  );
export type TerminalLaunch = z.infer<typeof terminalLaunchSchema>;
export type TerminalInfo = TerminalLaunch & {
  readonly id: string;
  readonly phase: "running" | "exited";
  readonly exitCode: number | null;
};
export type TerminalBuffer = {
  readonly id: string;
  readonly phase: TerminalInfo["phase"];
  readonly data: string;
  readonly sequence: number;
};
export const terminalEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("closed"), id: z.uuid() }),
  z.object({
    type: z.literal("data"),
    id: z.uuid(),
    data: z.string(),
    sequence: z.number().int(),
  }),
  z.object({
    type: z.literal("exit"),
    id: z.uuid(),
    exitCode: z.number().int(),
  }),
]);
export type TerminalEvent = z.infer<typeof terminalEventSchema>;
export const terminalInputSchema = z.object({
  id: z.uuid(),
  data: z.string().max(65536),
});
export const terminalResizeSchema = z.object({
  id: z.uuid(),
  columns: z.number().int().min(2).max(1000),
  rows: z.number().int().min(2).max(300),
});

export interface TerminalBridge {
  readonly launch: (request: TerminalLaunch) => Promise<TerminalInfo>;
  readonly list: () => Promise<readonly TerminalInfo[]>;
  readonly attach: (id: string) => Promise<TerminalBuffer>;
  readonly write: (id: string, data: string) => Promise<void>;
  readonly resize: (id: string, columns: number, rows: number) => Promise<void>;
  readonly close: (id: string) => Promise<void>;
  readonly onEvent: (callback: (event: TerminalEvent) => void) => () => void;
}
declare global {
  interface Window {
    readonly terminal: TerminalBridge;
  }
}
