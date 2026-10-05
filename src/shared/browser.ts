import { z } from "zod";

export const browserGroupSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9-]+$/);

export function browserUrl(value: unknown): string {
  const input = z.string().trim().min(1).max(8192).parse(value);
  const url = new URL(input);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use an HTTP or HTTPS address without embedded credentials.",
    );
  return url.href;
}
export type BrowserTab = {
  readonly id: string;
  readonly group: string;
  readonly connectorId: string | null;
  readonly url: string;
  readonly title: string;
  readonly phase: "loading" | "ready" | "error";
  readonly error: string | null;
  readonly back: boolean;
  readonly forward: boolean;
};
export type BrowserState = {
  readonly tabs: readonly BrowserTab[];
  readonly selected: string | null;
};
export const browserBoundsSchema = z.object({
  id: z.uuid(),
  rectangle: z
    .object({
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int().min(0),
      height: z.number().int().min(0),
    })
    .nullable(),
});
export interface BrowserBridge {
  readonly snapshot: (group?: string) => Promise<BrowserState>;
  readonly open: (
    url: string,
    connectorId?: string | null,
    group?: string,
  ) => Promise<BrowserState>;
  readonly navigate: (id: string, url: string) => Promise<BrowserState>;
  readonly select: (id: string) => Promise<BrowserState>;
  readonly close: (id: string) => Promise<BrowserState>;
  readonly action: (
    id: string,
    action: "back" | "forward" | "reload" | "external" | "focus",
  ) => Promise<void>;
  readonly bounds: (
    request: z.infer<typeof browserBoundsSchema>,
  ) => Promise<void>;
}
declare global {
  interface Window {
    readonly browser: BrowserBridge;
  }
}
