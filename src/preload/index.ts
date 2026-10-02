import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../shared/bridge";

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
