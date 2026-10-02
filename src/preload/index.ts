import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../shared/bridge";
import type { BrowserBridge } from "../shared/browser";
import type { ConnectorBridge } from "../shared/connectors";
import { type TerminalBridge, terminalEventSchema } from "../shared/terminal";
import type { WorkspaceBridge } from "../shared/workspace";

const bridge: DesktopBridge = {
  snapshot: () => ipcRenderer.invoke("models:snapshot"),
  install: () => ipcRenderer.invoke("models:install"),
  start: () => ipcRenderer.invoke("models:start"),
  stop: () => ipcRenderer.invoke("models:stop"),
  login: (provider) => ipcRenderer.invoke("models:login", provider),
  loginStatus: (state) => ipcRenderer.invoke("models:login-status", state),
  cancelLogin: (state) => ipcRenderer.invoke("models:cancel-login", state),
  reopenLogin: (state) => ipcRenderer.invoke("models:reopen-login", state),
  copyLaunch: (request) => ipcRenderer.invoke("models:copy-launch", request),
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

const terminal: TerminalBridge = {
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
  snapshot: () => ipcRenderer.invoke("browser:snapshot"),
  open: (url, connectorId) =>
    ipcRenderer.invoke("browser:open", {
      url,
      connectorId: connectorId ?? null,
    }),
  navigate: (id, url) => ipcRenderer.invoke("browser:navigate", { id, url }),
  select: (id) => ipcRenderer.invoke("browser:select", id),
  close: (id) => ipcRenderer.invoke("browser:close", id),
  action: (id, action) => ipcRenderer.invoke("browser:action", { id, action }),
  bounds: (request) => ipcRenderer.invoke("browser:bounds", request),
};
contextBridge.exposeInMainWorld("browser", browser);
const connectors: ConnectorBridge = {
  list: () => ipcRenderer.invoke("connectors:list"),
  add: (input) => ipcRenderer.invoke("connectors:add", input),
  disconnect: (id) => ipcRenderer.invoke("connectors:disconnect", id),
  open: (id) => ipcRenderer.invoke("connectors:open", id),
  check: (id) => ipcRenderer.invoke("connectors:check", id),
  call: (input) => ipcRenderer.invoke("connectors:call", input),
};
contextBridge.exposeInMainWorld("connectors", connectors);
