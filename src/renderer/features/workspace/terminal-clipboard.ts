import type { Terminal } from "@xterm/xterm";
import type { TerminalBridge } from "../../../shared/terminal";

export function terminalClipboard(
  terminal: Terminal,
  bridge: Pick<TerminalBridge, "readClipboard" | "writeClipboard">,
  report: (failure: unknown) => void,
) {
  let active = true;
  let pasting = false;
  let focusRevision = 0;
  const blur = () => {
    focusRevision += 1;
  };
  terminal.textarea?.addEventListener("blur", blur);
  window.addEventListener("blur", blur);
  terminal.attachCustomKeyEventHandler((event) => {
    const key = event.code || event.key.toLowerCase();
    if (
      !event.ctrlKey ||
      !event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.isComposing ||
      !["KeyC", "KeyV", "c", "v"].includes(key)
    )
      return true;
    event.preventDefault();
    if (event.type !== "keydown" || event.repeat || !active) return false;
    if (key === "KeyC" || key === "c") {
      const selected = terminal.getSelection();
      if (selected) void bridge.writeClipboard(selected).catch(report);
    } else if (!pasting && !terminal.options.disableStdin) {
      pasting = true;
      const revision = focusRevision;
      void bridge
        .readClipboard()
        .then((text) => {
          if (
            active &&
            revision === focusRevision &&
            !terminal.options.disableStdin &&
            document.hasFocus() &&
            terminal.textarea === document.activeElement
          )
            terminal.paste(text);
        })
        .catch(report)
        .finally(() => {
          pasting = false;
        });
    }
    return false;
  });
  return () => {
    active = false;
    terminal.textarea?.removeEventListener("blur", blur);
    window.removeEventListener("blur", blur);
  };
}
