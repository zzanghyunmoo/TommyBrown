import { z } from "zod";

export const modelIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/:()+@-]*$/);

export const mappingRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const launchRequestSchema = z.object({
  cli: z.enum(["claude", "codex", "antigravity"]),
  model: modelIdSchema,
  mappingRevision: mappingRevisionSchema.optional(),
});
export type LaunchRequest = z.infer<typeof launchRequestSchema>;
export type LaunchProfile = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string | null>>;
};
