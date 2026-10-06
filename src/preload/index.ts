import { contextBridge, ipcRenderer } from "electron";
import type { AppearanceBridge } from "../shared/appearance";
import type { DesktopBridge } from "../shared/bridge";
import type { BrowserBridge } from "../shared/browser";
import type { ConnectorBridge } from "../shared/connectors";
import { type TerminalBridge, terminalEventSchema } from "../shared/terminal";
import {
  type WorkbenchBridge,
  workbenchEventSchema,
} from "../shared/workbench";
import type { WorkspaceBridge } from "../shared/workspace";

const appearance: AppearanceBridge = {
  get: () => ipcRenderer.invoke("appearance:get"),
  set: (theme) => ipcRenderer.invoke("appearance:set", theme),
};
contextBridge.exposeInMainWorld("appearance", appearance);

const bridge: DesktopBridge = {
  launchSettings: () => ipcRenderer.invoke("models:launch-settings"),
  saveLaunchSelection: (selection) =>
    ipcRenderer.invoke("models:save-launch-selection", selection),
  snapshot: () => ipcRenderer.invoke("models:snapshot"),
  install: () => ipcRenderer.invoke("models:install"),
  start: () => ipcRenderer.invoke("models:start"),
  stop: () => ipcRenderer.invoke("models:stop"),
  login: (provider) => ipcRenderer.invoke("models:login", provider),
  loginStatus: (state) => ipcRenderer.invoke("models:login-status", state),
  cancelLogin: (state) => ipcRenderer.invoke("models:cancel-login", state),
  reopenLogin: (state) => ipcRenderer.invoke("models:reopen-login", state),
  copyLaunch: (request) => ipcRenderer.invoke("models:copy-launch", request),
  saveMappings: (settings) =>
    ipcRenderer.invoke("models:save-mappings", settings),
};
contextBridge.exposeInMainWorld("desktop", bridge);

const workspace: WorkspaceBridge = {
  searchVault: (request) => ipcRenderer.invoke("vault:search", request),
  openObsidian: (request) => ipcRenderer.invoke("vault:open", request),
  snapshot: () => ipcRenderer.invoke("workspace:snapshot"),
  chooseSpace: (kind) => ipcRenderer.invoke("workspace:choose", kind),
  selectSpace: (id) => ipcRenderer.invoke("workspace:select", id),
  removeSpace: (id) => ipcRenderer.invoke("workspace:remove", id),
  list: (request) => ipcRenderer.invoke("workspace:list", request),
  read: (request) => ipcRenderer.invoke("workspace:read", request),
  save: (request) => ipcRenderer.invoke("workspace:save", request),
  setDirty: (dirty) => ipcRenderer.invoke("workspace:dirty", dirty),
};
contextBridge.exposeInMainWorld("workspace", workspace);

const workbench: WorkbenchBridge = {
  enable: (enabled) => ipcRenderer.invoke("workbench:enable", enabled),
  reset: () => ipcRenderer.invoke("workbench:reset"),
  onEvent: (callback) => {
    const listener = (_event: unknown, value: unknown) =>
      callback(workbenchEventSchema.parse(value));
    ipcRenderer.on("workbench:event", listener);
    return () => ipcRenderer.removeListener("workbench:event", listener);
  },
};
contextBridge.exposeInMainWorld("workbench", workbench);

const terminal: TerminalBridge = {
  readClipboard: () => ipcRenderer.invoke("terminal:clipboard-read"),
  writeClipboard: (text) =>
    ipcRenderer.invoke("terminal:clipboard-write", text),
  launch: (request) => ipcRenderer.invoke("terminal:launch", request),
  list: () => ipcRenderer.invoke("terminal:list"),
  attach: (id) => ipcRenderer.invoke("terminal:attach", id),
  write: (id, data) => ipcRenderer.invoke("terminal:write", { id, data }),
  resize: (id, columns, rows) =>
    ipcRenderer.invoke("terminal:resize", { id, columns, rows }),
  close: (id) => ipcRenderer.invoke("terminal:close", id),
  onEvent: (callback) => {
    const listener = (_event: unknown, value: unknown) =>
      callback(terminalEventSchema.parse(value));
    ipcRenderer.on("terminal:event", listener);
    return () => {
      ipcRenderer.removeListener("terminal:event", listener);
    };
  },
};
contextBridge.exposeInMainWorld("terminal", terminal);

const browser: BrowserBridge = {
  snapshot: (group) => ipcRenderer.invoke("browser:snapshot", group),
  open: (url, connectorId, group) =>
    ipcRenderer.invoke("browser:open", {
      url,
      connectorId: connectorId ?? null,
      group: group ?? "browser",
    }),
  navigate: (id, url) => ipcRenderer.invoke("browser:navigate", { id, url }),
  select: (id) => ipcRenderer.invoke("browser:select", id),
  close: (id) => ipcRenderer.invoke("browser:close", id),
  action: (id, action) => ipcRenderer.invoke("browser:action", { id, action }),
  bounds: (request) => ipcRenderer.invoke("browser:bounds", request),
};
contextBridge.exposeInMainWorld("browser", browser);
const connectors: ConnectorBridge = {
  gateway: () => ipcRenderer.invoke("connectors:gateway"),
  list: () => ipcRenderer.invoke("connectors:list"),
  add: (input) => ipcRenderer.invoke("connectors:add", input),
  setTools: (input) => ipcRenderer.invoke("connectors:set-tools", input),
  disconnect: (id) => ipcRenderer.invoke("connectors:disconnect", id),
  open: (id, group) =>
    ipcRenderer.invoke("connectors:open", { id, group: group ?? "browser" }),
  check: (id) => ipcRenderer.invoke("connectors:check", id),
  call: (input) => ipcRenderer.invoke("connectors:call", input),
};
contextBridge.exposeInMainWorld("connectors", connectors);
