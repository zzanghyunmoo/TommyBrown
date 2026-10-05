import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { IpcMainInvokeEvent } from "electron";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  session,
  shell,
} from "electron";
import { z } from "zod";
import { themeCanvas } from "../shared/appearance";
import { browserGroupSchema } from "../shared/browser";
import { AppearanceStore } from "./appearance";
import { BrowserService } from "./browser/service";
import { connectorProfile } from "./connectors/profiles";
import { registerConnectors } from "./connectors/register";
import { ModelService } from "./models";
import { TerminalService } from "./terminal/service";
import { WorkbenchController } from "./workbench/controller";
import { WorkspaceFiles } from "./workspace/files";
import { WorkspaceStore } from "./workspace/store";
import { VaultService } from "./workspace/vault";

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
  const [appearance, models, spaces] = await Promise.all([
    AppearanceStore.open(
      join(app.getPath("userData"), "appearance.json"),
      nativeTheme.shouldUseDarkColors ? "dark" : "light",
    ),
    ModelService.create(app.getPath("userData")),
    WorkspaceStore.open(join(app.getPath("userData"), "workspace.json")),
  ]);
  nativeTheme.themeSource = appearance.get();
  const files = new WorkspaceFiles(spaces);
  const vaults = new VaultService(spaces, files, (url) =>
    shell.openExternal(url),
  );
  let hasDirtyDocuments = false;
  const entry = join(app.getAppPath(), "dist", "renderer", "index.html");
  const entryUrl = pathToFileURL(entry).href;
  const window = new BrowserWindow({
    title: "TommyBrown",
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: themeCanvas[appearance.get()],
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(app.getAppPath(), "dist", "preload", "index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.once("ready-to-show", () => {
    if (process.env["TOMMYBROWN_TEST"] !== "1") window.show();
  });
  const workbench = new WorkbenchController(window);
  const browser = new BrowserService(window, (contents, group) =>
    workbench.attach(contents, group),
  );
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
  let shutdownPending = false;
  const pending = new Set<Promise<unknown>>();
  const queues = { models: Promise.resolve(), connectors: Promise.resolve() };
  function bind(channel: string, action: (input: unknown) => unknown): void {
    ipcMain.handle(channel, (event, input: unknown) => {
      authorize(event);
      if (shutdownPending) throw new Error("The application is shutting down.");
      const lane = channel.startsWith("models:")
        ? "models"
        : channel.startsWith("connectors:") || channel === "terminal:launch"
          ? "connectors"
          : undefined;
      const result = (lane ? queues[lane] : Promise.resolve()).then(() =>
        action(input),
      );
      pending.add(result);
      const settled = result.then(
        () => {
          pending.delete(result);
        },
        () => {
          pending.delete(result);
        },
      );
      if (lane) queues[lane] = settled;
      return result;
    });
  }
  const connectors = await registerConnectors(
    app.getPath("userData"),
    browser,
    bind,
    (id) => terminals.disconnectConnector(id),
  );
  bind("appearance:get", () => appearance.get());
  bind("appearance:set", async (input) => {
    const theme = await appearance.set(input);
    nativeTheme.themeSource = theme;
    window.setBackgroundColor(themeCanvas[theme]);
    return theme;
  });
  const terminals = new TerminalService(
    spaces,
    (request) => models.launchProfile(request),
    (event) => {
      if (!window.webContents.isDestroyed())
        window.webContents.send("terminal:event", event);
    },
    (cli, ids) => connectorProfile(connectors, cli, ids),
  );
  bind("models:snapshot", () => models.snapshot());
  bind("workbench:enable", (input) =>
    workbench.enable(z.boolean().parse(input)),
  );
  bind("workbench:reset", () => workbench.reset());
  bind("models:install", () => models.install());
  bind("models:start", () =>
    models.start(process.env["TOMMYBROWN_TEST"] === "1" ? 0 : 8317),
  );
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
  bind("models:save-mappings", (input) => models.saveMappings(input));
  bind("workspace:snapshot", () => spaces.snapshot());
  bind("workspace:choose", async (input) => {
    const kind = z.enum(["workspace", "vault"]).parse(input);
    const selection = await dialog.showOpenDialog(window, {
      title: kind === "vault" ? "Obsidian 보관함 선택" : "작업 공간 선택",
      properties: ["openDirectory"],
    });
    const directory = selection.filePaths[0];
    return selection.canceled || !directory
      ? spaces.snapshot()
      : spaces.add(directory, kind);
  });
  bind("workspace:select", (input) => spaces.select(z.uuid().parse(input)));
  bind("workspace:remove", (input) => spaces.remove(z.uuid().parse(input)));
  bind("workspace:list", (input) => files.list(input));
  bind("workspace:read", (input) => files.read(input));
  bind("workspace:save", (input) => files.save(input));
  bind("vault:search", (input) => vaults.search(input));
  bind("vault:open", (input) => vaults.open(input));
  bind("workspace:dirty", (input) => {
    hasDirtyDocuments = z.boolean().parse(input);
  });
  bind("terminal:launch", (input) => terminals.launch(input));
  bind("terminal:list", () => terminals.list());
  bind("terminal:attach", (input) => terminals.attach(z.uuid().parse(input)));
  bind("terminal:write", (input) => terminals.write(input));
  bind("terminal:resize", (input) => terminals.resize(input));
  bind("terminal:close", (input) => terminals.close(z.uuid().parse(input)));
  bind("browser:snapshot", (input) =>
    browser.snapshot(browserGroupSchema.default("browser").parse(input)),
  );
  bind("browser:open", (input) => {
    const request = z
      .object({
        url: z.string(),
        connectorId: z.uuid().nullable(),
        group: browserGroupSchema.default("browser"),
      })
      .parse(input);
    if (request.connectorId) connectors.require(request.connectorId);
    return browser.open(request.url, request.connectorId, request.group);
  });
  bind("browser:navigate", (input) => browser.navigate(input));
  bind("browser:select", (input) => browser.select(z.uuid().parse(input)));
  bind("browser:close", (input) => browser.close(z.uuid().parse(input)));
  bind("browser:action", (input) => browser.action(input));
  bind("browser:bounds", (input) => browser.bounds(input));
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
  window.on("close", (event) => {
    if (!closing) {
      event.preventDefault();
      app.quit();
    }
  });
  app.on("before-quit", (event) => {
    if (closing) return;
    event.preventDefault();
    if (shutdownPending) return;
    shutdownPending = true;
    Promise.allSettled([...pending])
      .then(async () => {
        if (hasDirtyDocuments) {
          const answer = await dialog.showMessageBox(window, {
            type: "warning",
            message: "저장하지 않은 문서를 닫을까요?",
            detail: "저장하지 않은 변경 사항은 사라집니다.",
            buttons: ["계속 편집", "변경 사항 버리고 종료"],
            defaultId: 0,
            cancelId: 0,
          });
          if (answer.response !== 1) return;
        }
        await terminals.stop();
        browser.stop();
        await models.stop();
        closing = true;
        app.quit();
      })
      .catch((error: unknown) => {
        closing = false;
        dialog.showErrorBox(
          "TommyBrown shutdown failed",
          error instanceof Error
            ? error.message
            : "The gateway could not stop.",
        );
      })
      .finally(() => {
        shutdownPending = false;
      });
  });
  app.on("window-all-closed", () => app.quit());
  await window.loadFile(entry, {
    query: process.env["TOMMYBROWN_SHOWCASE"] === "1" ? { showcase: "1" } : {},
  });
}
