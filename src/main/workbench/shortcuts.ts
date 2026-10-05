import { shortcuts, type WorkbenchCommand } from "../../shared/workbench";

type KeyInput = {
  readonly type: string;
  readonly key: string;
  readonly control: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
  readonly isAutoRepeat: boolean;
  readonly isComposing?: boolean;
};
type KeyResult = {
  readonly consumed: boolean;
  readonly command?: WorkbenchCommand;
};

export class PrefixKeys {
  mode: "idle" | "prefix" | "resize" = "idle";
  reset() {
    this.mode = "idle";
  }
  input(input: KeyInput): KeyResult {
    if (input.type !== "keyDown" || input.isComposing)
      return { consumed: false };
    if (["Shift", "Control", "Alt", "Meta"].includes(input.key))
      return { consumed: this.mode !== "idle" };
    const prefix =
      input.control &&
      !input.shift &&
      !input.alt &&
      !input.meta &&
      input.key.toLowerCase() === "b";
    if (prefix) {
      if (input.isAutoRepeat) return { consumed: true };
      if (this.mode === "prefix") {
        this.reset();
        return { consumed: false };
      }
      this.mode = "prefix";
      return { consumed: true };
    }
    if (this.mode === "idle") return { consumed: false };
    if (input.key === "Escape" || input.key === "Enter") {
      this.reset();
      return { consumed: true };
    }
    const key = input.shift ? input.key.toUpperCase() : input.key;
    if (this.mode === "resize") {
      switch (key) {
        case "h":
        case "ArrowLeft":
          return { consumed: true, command: "resize-left" };
        case "j":
        case "ArrowDown":
          return { consumed: true, command: "resize-down" };
        case "k":
        case "ArrowUp":
          return { consumed: true, command: "resize-up" };
        case "l":
        case "ArrowRight":
          return { consumed: true, command: "resize-right" };
        default:
          return { consumed: true };
      }
    }
    const command =
      !input.control && !input.alt && !input.meta
        ? shortcuts.find((item) => item.key === key)?.command
        : undefined;
    this.mode = command === "resize" ? "resize" : "idle";
    return command ? { consumed: true, command } : { consumed: true };
  }
}
