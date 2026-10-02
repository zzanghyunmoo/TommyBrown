import { z } from "zod";

export const providerSchema = z.enum(["claude", "codex", "antigravity"]);
export type Provider = z.infer<typeof providerSchema>;

export const accountSchema = z.object({
  name: z.string(),
  provider: z.string().default("unknown"),
  email: z.string().default(""),
  status: z.string().default("unknown"),
  disabled: z.boolean().default(false),
});
export type ProxyAccount = z.infer<typeof accountSchema>;

export const modelSchema = z.object({
  id: z.string().min(1),
  owned_by: z.string().default("unknown"),
});
export type ProxyModel = z.infer<typeof modelSchema>;

export const loginSchema = z.object({ url: z.url(), state: z.string().min(1) });
export type ProxyLogin = z.infer<typeof loginSchema>;
export const loginStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("wait") }),
  z.object({ status: z.literal("ok") }),
  z.object({
    status: z.literal("error"),
    error: z.string().default("Login failed"),
  }),
]);
export type LoginStatus = z.infer<typeof loginStatusSchema>;

export type GatewayStatus =
  | { readonly phase: "stopped" }
  | { readonly phase: "starting" }
  | { readonly phase: "running"; readonly port: number; readonly pid: number }
  | { readonly phase: "stopping" }
  | { readonly phase: "error"; readonly message: string };

export class GatewayError extends Error {
  override readonly name = "GatewayError";
  constructor(
    readonly code:
      | "configuration"
      | "download"
      | "integrity"
      | "runtime"
      | "login",
    message: string,
  ) {
    super(message);
  }
}
