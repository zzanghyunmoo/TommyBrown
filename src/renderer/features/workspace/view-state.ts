import { z } from "zod";
import { fileRequestSchema } from "../../../shared/workspace";

const viewSchema = z.object({
  page: z.enum(["models", "workspace"]).nullable().default(null),
  pane: z.enum(["documents", "browser", "connectors"]).default("documents"),
  documents: z.array(fileRequestSchema).max(32).default([]),
  selectedDocument: z.string().nullable().default(null),
  preview: z.boolean().default(false),
  webTabs: z
    .array(z.object({ url: z.string(), connectorId: z.uuid().nullable() }))
    .max(16)
    .default([]),
  selectedWeb: z.number().int().min(0).default(0),
  browserGroups: z
    .record(
      z.string(),
      z.object({
        tabs: z
          .array(
            z.object({ url: z.string(), connectorId: z.uuid().nullable() }),
          )
          .max(16),
        selected: z.number().int().min(0),
      }),
    )
    .default({}),
  layout: z.unknown().optional(),
  spaceLayouts: z.record(z.string(), z.unknown()).default({}),
  sidebarHidden: z.boolean().default(false),
  appMode: z.enum(["app", "documents", "connectors"]).default("app"),
});
type ViewState = z.infer<typeof viewSchema>;
const key = "tommybrown.view.v1";
export function readViewState(): ViewState {
  try {
    return viewSchema.parse(JSON.parse(localStorage.getItem(key) ?? "{}"));
  } catch {
    return viewSchema.parse({});
  }
}
export function saveViewState(update: Partial<ViewState>): void {
  const text = JSON.stringify(
    viewSchema.parse({ ...readViewState(), ...update }),
  );
  if (localStorage.getItem(key) !== text) localStorage.setItem(key, text);
}
