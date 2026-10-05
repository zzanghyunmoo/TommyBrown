import { randomUUID } from "node:crypto";
import { type BrowserWindow, shell, WebContentsView } from "electron";
import { z } from "zod";
import {
  type BrowserState,
  type BrowserTab,
  browserBoundsSchema,
  browserGroupSchema,
  browserUrl,
} from "../../shared/browser";
import { browserSession } from "./session";

type Tab = {
  readonly id: string;
  readonly group: string;
  readonly connectorId: string | null;
  readonly view: WebContentsView;
  url: string;
  title: string;
  phase: BrowserTab["phase"];
  error: string | null;
};

export class BrowserService {
  private readonly tabs = new Map<string, Tab>();
  private readonly selected = new Map<string, string>();
  constructor(
    private readonly window: BrowserWindow,
    private readonly onContents?: (
      contents: Electron.WebContents,
      group: string,
    ) => void,
  ) {}

  snapshot(group = "browser"): BrowserState {
    return {
      selected: this.selected.get(group) ?? null,
      tabs: [...this.tabs.values()]
        .filter((tab) => tab.group === group)
        .map((tab) => ({
          id: tab.id,
          group: tab.group,
          connectorId: tab.connectorId,
          url: tab.url,
          title: tab.title,
          phase: tab.phase,
          error: tab.error,
          back: tab.view.webContents.navigationHistory.canGoBack(),
          forward: tab.view.webContents.navigationHistory.canGoForward(),
        })),
    };
  }

  open(
    input: unknown,
    connectorId: string | null = null,
    inputGroup = "browser",
  ): BrowserState {
    const url = browserUrl(input);
    const group = browserGroupSchema.parse(inputGroup);
    if (this.tabs.size >= 16)
      throw new Error("Close a browser tab before opening another (limit 16).");
    const view = new WebContentsView({
      webPreferences: {
        session: browserSession(connectorId),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    const id = randomUUID();
    const tab: Tab = {
      id,
      group,
      connectorId,
      view,
      url,
      title: new URL(url).hostname,
      phase: "loading",
      error: null,
    };
    this.tabs.set(id, tab);
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    this.onContents?.(view.webContents, group);
    view.webContents.setWindowOpenHandler(({ url: next }) => {
      try {
        this.open(next, connectorId, group);
      } catch {
        tab.error = "This page tried to open an unsupported address.";
      }
      return { action: "deny" };
    });
    const guard = (
      navigation: { preventDefault: () => void },
      next: string,
    ) => {
      try {
        browserUrl(next);
      } catch {
        navigation.preventDefault();
        tab.error = "Only HTTP and HTTPS navigation is allowed.";
      }
    };
    view.webContents.on("will-navigate", guard);
    view.webContents.on("will-redirect", guard);
    view.webContents.on("did-start-loading", () => {
      tab.phase = "loading";
    });
    view.webContents.on("did-stop-loading", () => {
      if (tab.phase !== "error") tab.phase = "ready";
    });
    view.webContents.on("did-navigate", (_event, next) => {
      tab.url = next;
    });
    view.webContents.on("did-navigate-in-page", (_event, next, main) => {
      if (main) tab.url = next;
    });
    view.webContents.on("page-title-updated", (_event, title) => {
      tab.title = title.slice(0, 120);
    });
    view.webContents.on(
      "did-fail-load",
      (_event, code, description, _url, main) => {
        if (main && code !== -3) {
          tab.phase = "error";
          tab.error = description;
        }
      },
    );
    this.select(id);
    this.load(tab, url);
    return this.snapshot(group);
  }

  navigate(input: unknown): BrowserState {
    const request = z.object({ id: z.uuid(), url: z.string() }).parse(input);
    const tab = this.require(request.id);
    this.load(tab, browserUrl(request.url));
    return this.snapshot(tab.group);
  }
  select(id: string): BrowserState {
    const selected = this.require(id);
    if (this.selected.get(selected.group) === id)
      return this.snapshot(selected.group);
    this.selected.set(selected.group, id);
    for (const tab of this.tabs.values())
      if (tab.group === selected.group) tab.view.setVisible(false);
    return this.snapshot(selected.group);
  }
  close(id: string): BrowserState {
    const tab = this.require(id);
    this.window.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(id);
    if (this.selected.get(tab.group) === id) {
      const next = [...this.tabs.values()].find(
        (item) => item.group === tab.group,
      );
      if (next) this.selected.set(tab.group, next.id);
      else this.selected.delete(tab.group);
    }
    return this.snapshot(tab.group);
  }
  async action(input: unknown): Promise<void> {
    const request = z
      .object({
        id: z.uuid(),
        action: z.enum(["back", "forward", "reload", "external", "focus"]),
      })
      .parse(input);
    const tab = this.require(request.id);
    const contents = tab.view.webContents;
    if (request.action === "focus" && tab.view.getVisible()) contents.focus();
    if (request.action === "back" && contents.navigationHistory.canGoBack())
      contents.navigationHistory.goBack();
    if (
      request.action === "forward" &&
      contents.navigationHistory.canGoForward()
    )
      contents.navigationHistory.goForward();
    if (request.action === "reload") {
      tab.error = null;
      tab.phase = "loading";
      contents.reload();
    }
    if (request.action === "external")
      await shell.openExternal(browserUrl(tab.url));
  }
  bounds(input: unknown): void {
    const { id, rectangle } = browserBoundsSchema.parse(input);
    const tab = this.require(id);
    if (
      !rectangle ||
      id !== this.selected.get(tab.group) ||
      rectangle.width < 10 ||
      rectangle.height < 10
    ) {
      tab.view.setVisible(false);
      return;
    }
    const { width, height } = this.window.getContentBounds();
    const x = Math.max(0, Math.min(width, rectangle.x));
    const y = Math.max(0, Math.min(height, rectangle.y));
    tab.view.setBounds({
      x,
      y,
      width: Math.min(rectangle.width, width - x),
      height: Math.min(rectangle.height, height - y),
    });
    tab.view.setVisible(true);
  }
  stop(): void {
    for (const id of [...this.tabs.keys()]) this.close(id);
  }
  async disconnect(connectorId: string): Promise<void> {
    for (const tab of [...this.tabs.values()])
      if (tab.connectorId === connectorId) this.close(tab.id);
    const partition = browserSession(connectorId);
    await partition.clearStorageData();
    await partition.clearCache();
    await partition.closeAllConnections();
  }
  private require(input: string): Tab {
    const tab = this.tabs.get(z.uuid().parse(input));
    if (!tab) throw new Error("This browser tab is no longer available.");
    return tab;
  }
  private load(tab: Tab, url: string): void {
    tab.url = url;
    tab.phase = "loading";
    tab.error = null;
    void tab.view.webContents.loadURL(url).catch((error: unknown) => {
      if (error instanceof Error && !error.message.includes("ERR_ABORTED")) {
        tab.phase = "error";
        tab.error =
          "This page could not load. Check the address or open it externally.";
      }
    });
  }
}
