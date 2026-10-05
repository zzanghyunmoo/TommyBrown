import { z } from "zod";

export const themeSchema = z.enum(["light", "dark"]);
export type Theme = z.infer<typeof themeSchema>;
export const themeCanvas: Readonly<Record<Theme, string>> = {
  light: "#f1f2f4",
  dark: "#17191d",
};

export interface AppearanceBridge {
  readonly get: () => Promise<Theme>;
  readonly set: (theme: Theme) => Promise<Theme>;
}

declare global {
  interface Window {
    readonly appearance: AppearanceBridge;
  }
}
