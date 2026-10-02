import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { IpcMainInvokeEvent } from "electron";
import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import { z } from "zod";
import { ModelService } from "./models";

app.setName("TommyBrown");
const customData = process.env["TOMMYBROWN_DATA_DIR"];
if (customData) app.setPath("userData", resolve(customData));
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else
  void boot().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown startup failure.";
    console.error(`TommyBrown could not start: ${message}`);
    if (process.env["TOMMYBROWN_TEST"] !== "1")
      dialog.showErrorBox("TommyBrown could not start", message);
    app.exit(1);
  });

async function boot(): Promise<void> {
  await app.whenReady();
  const models = await ModelService.create(app.getPath("userData"));
  const entry = join(app.getAppPath(), "dist", "renderer", "index.html");
  const entryUrl = pathToFileURL(entry).href;
  const window = new BrowserWindow({
    title: "TommyBrown",
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f7f6f3",
    show: process.env["TOMMYBROWN_TEST"] !== "1",
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "preload", "index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  function authorize(event: IpcMainInvokeEvent): void {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("Untrusted IPC sender");
    const senderUrl = new URL(event.senderFrame.url);
    senderUrl.search = "";
    senderUrl.hash = "";
    if (senderUrl.href !== entryUrl) throw new Error("Untrusted IPC origin");
  }
  let operations: Promise<void> = Promise.resolve();
  function bind(channel: string, action: (input: unknown) => unknown): void {
    ipcMain.handle(channel, (event, input: unknown) => {
      authorize(event);
      const result = operations.then(() => action(input));
      operations = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
  }
  bind("models:snapshot", () => models.snapshot());
  bind("models:install", () => models.install());
  bind("models:start", () => models.start());
  bind("models:stop", () => models.stop());
  bind("models:login", (input) => models.login(input));
  bind("models:login-status", (input) =>
    models.loginStatus(z.string().min(1).parse(input)),
  );
  bind("models:cancel-login", (input) =>
    models.cancelLogin(z.string().min(1).parse(input)),
  );
  bind("models:reopen-login", (input) =>
    models.reopenLogin(z.string().min(1).parse(input)),
  );
  bind("models:copy-launch", (input) => models.copyLaunch(input));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  app.on("second-instance", () => {
    window.show();
    window.focus();
  });
  let closing = false;
  app.on("before-quit", (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    operations
      .then(() => models.stop())
      .then(() => app.quit())
      .catch((error: unknown) => {
        closing = false;
        dialog.showErrorBox(
          "TommyBrown shutdown failed",
          error instanceof Error
            ? error.message
            : "The gateway could not stop.",
        );
      });
  });
  app.on("window-all-closed", () => app.quit());
  await window.loadFile(entry, {
    query: process.env["TOMMYBROWN_SHOWCASE"] === "1" ? { showcase: "1" } : {},
  });
}
