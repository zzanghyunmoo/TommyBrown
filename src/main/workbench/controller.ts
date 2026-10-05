import type { BrowserWindow, WebContents } from "electron";
import type { WorkbenchEvent } from "../../shared/workbench";
import { PrefixKeys } from "./shortcuts";

export class WorkbenchController {
  private readonly keys = new PrefixKeys();
  private enabled = false;
  constructor(private readonly window: BrowserWindow) {
    this.attach(window.webContents, null);
    window.on("blur", () => this.reset());
  }
  enable(enabled: boolean) {
    this.enabled = enabled;
    this.reset();
  }
  reset() {
    this.keys.reset();
    this.send({ type: "mode", mode: "idle" });
  }
  attach(contents: WebContents, group: string | null) {
    contents.on("focus", () => {
      if (this.enabled && group) this.send({ type: "focus", group });
    });
    contents.on("before-input-event", (event, input) => {
      if (!this.enabled) return;
      const previous = this.keys.mode;
      const result = this.keys.input(input);
      if (result.consumed) event.preventDefault();
      if (previous !== this.keys.mode)
        this.send({ type: "mode", mode: this.keys.mode });
      if (result.command)
        this.send({ type: "command", command: result.command, group });
    });
  }
  private send(event: WorkbenchEvent) {
    if (!this.window.webContents.isDestroyed())
      this.window.webContents.send("workbench:event", event);
  }
}
