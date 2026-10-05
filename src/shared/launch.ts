import { z } from "zod";

export const launchRequestSchema = z.object({
  cli: z.enum(["claude", "codex"]),
  model: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/:()+@-]*$/),
});
export type LaunchRequest = z.infer<typeof launchRequestSchema>;
export type LaunchProfile = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string | null>>;
};
