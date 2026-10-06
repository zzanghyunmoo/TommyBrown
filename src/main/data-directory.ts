import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { App } from "electron";

export function configureDataDirectory(
  app: Pick<App, "getPath" | "setPath" | "isPackaged">,
  customData: string | undefined,
): void {
  const directory = customData
    ? resolve(customData)
    : app.isPackaged
      ? join(app.getPath("appData"), "TommyBrown Desktop")
      : app.getPath("userData");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  app.setPath("userData", directory);
  app.setPath("sessionData", directory);
}
