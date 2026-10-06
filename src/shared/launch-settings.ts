import { z } from "zod";
import { modelIdSchema } from "./launch";

export const cliSchema = z.enum([
  "powershell",
  "claude",
  "codex",
  "antigravity",
]);
export const launchSelectionSchema = z
  .object({
    cli: cliSchema,
    model: modelIdSchema.nullable(),
  })
  .refine((value) => value.cli !== "powershell" || value.model === null);
export type LaunchSelection = z.infer<typeof launchSelectionSchema>;
export const launchSettingsSchema = z.object({
  cli: cliSchema,
  models: z.object({
    claude: modelIdSchema.nullable(),
    codex: modelIdSchema.nullable(),
    antigravity: modelIdSchema.nullable(),
  }),
});
export type LaunchSettings = z.infer<typeof launchSettingsSchema>;
export function defaultLaunchSettings(): LaunchSettings {
  return {
    cli: "powershell",
    models: { claude: null, codex: null, antigravity: null },
  };
}
