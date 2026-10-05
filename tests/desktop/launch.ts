import { writeFile } from "node:fs/promises";
import type { ElectronApplication } from "@playwright/test";

export function desktopCommand() {
  const executablePath = process.env["TOMMYBROWN_PACKAGED_APP"];
  return executablePath ? { executablePath, args: [] } : { args: ["."] };
}
export async function desktopWindow(desktop: ElectronApplication) {
  const page = await desktop.firstWindow();
  if (process.env["TOMMYBROWN_PACKAGED_APP"])
    await desktop.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window) throw new Error("No desktop window");
      window.show();
    });
  return page;
}
export async function nativeCapture(
  desktop: ElectronApplication,
  path: string,
) {
  if (!process.env["TOMMYBROWN_PACKAGED_APP"]) return;
  const bytes = await desktop.evaluate(
    async ({ BrowserWindow, desktopCapturer }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window) throw new Error("No desktop window");
      const sources = await desktopCapturer.getSources({
        types: ["window"],
        thumbnailSize: { width: 1600, height: 1200 },
      });
      const source = sources.find(
        (candidate) => candidate.id === window.getMediaSourceId(),
      );
      if (!source || source.thumbnail.isEmpty())
        throw new Error("Native window capture is unavailable");
      return source.thumbnail.toPNG().toString("base64");
    },
  );
  await writeFile(path, Buffer.from(bytes, "base64"));
}
