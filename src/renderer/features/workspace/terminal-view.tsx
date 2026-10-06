import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { type ITheme, Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TerminalEvent, TerminalInfo } from "../../../shared/terminal";
import { Notice } from "../../components/primitives";
import { subscribeTheme, themeColor } from "../../theme";

function terminalTheme(): ITheme {
  return {
    background: themeColor("--terminal"),
    foreground: themeColor("--terminal-ink"),
    cursor: themeColor("--terminal-ink"),
    cursorAccent: themeColor("--terminal"),
    selectionBackground: themeColor("--selection"),
    black: themeColor("--ansi-black"),
    red: themeColor("--ansi-red"),
    green: themeColor("--ansi-green"),
    yellow: themeColor("--ansi-yellow"),
    blue: themeColor("--ansi-blue"),
    magenta: themeColor("--ansi-magenta"),
    cyan: themeColor("--ansi-cyan"),
    white: themeColor("--ansi-white"),
    brightBlack: themeColor("--ansi-black"),
    brightRed: themeColor("--ansi-red"),
    brightGreen: themeColor("--ansi-green"),
    brightYellow: themeColor("--ansi-yellow"),
    brightBlue: themeColor("--ansi-blue"),
    brightMagenta: themeColor("--ansi-magenta"),
    brightCyan: themeColor("--ansi-cyan"),
    brightWhite: themeColor("--ansi-white"),
  };
}

export function TerminalView({
  session,
  openUrl,
}: {
  readonly session: TerminalInfo;
  readonly openUrl: (url: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const link = useRef(openUrl);
  useLayoutEffect(() => {
    link.current = openUrl;
  }, [openUrl]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!host.current) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "Consolas, monospace",
      scrollback: 5000,
      allowProposedApi: false,
      minimumContrastRatio: 4.5,
      theme: terminalTheme(),
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon((_event, url) => link.current(url)));
    terminal.open(host.current);
    const unsubscribeTheme = subscribeTheme(() => {
      terminal.options.theme = terminalTheme();
    });
    let active = true;
    let initialized = false;
    let sequence = 0;
    const queued: TerminalEvent[] = [];
    const report = (failure: unknown) => {
      if (active && failure instanceof Error) setError(failure.message);
    };
    function consume(event: TerminalEvent) {
      if (event.type === "data" && event.sequence > sequence) {
        sequence = event.sequence;
        terminal.write(event.data);
      }
      if (event.type === "exit") {
        terminal.options.disableStdin = true;
        terminal.writeln(`\r\n[프로세스 종료: ${event.exitCode}]`);
      }
    }
    const unsubscribe = window.terminal.onEvent((event) => {
      if (event.id !== session.id || !active) return;
      if (!initialized) queued.push(event);
      else consume(event);
    });
    window.terminal
      .attach(session.id)
      .then((snapshot) => {
        if (!active) return;
        sequence = snapshot.sequence;
        terminal.options.disableStdin = snapshot.phase === "exited";
        terminal.write(snapshot.data);
        initialized = true;
        for (const event of queued) consume(event);
        queued.length = 0;
      })
      .catch(report);
    const input = terminal.onData((data) => {
      void window.terminal.write(session.id, data).catch(report);
    });
    const resize = terminal.onResize(({ cols, rows }) => {
      void window.terminal.resize(session.id, cols, rows).catch(report);
    });
    const observer = new ResizeObserver(() => {
      if (
        active &&
        host.current &&
        host.current.clientWidth > 0 &&
        host.current.clientHeight > 0
      ) {
        const dimensions = fit.proposeDimensions();
        if (dimensions)
          terminal.resize(
            Math.max(2, Math.min(1000, dimensions.cols)),
            Math.max(2, Math.min(300, dimensions.rows)),
          );
      }
    });
    observer.observe(host.current);
    return () => {
      active = false;
      observer.disconnect();
      unsubscribeTheme();
      unsubscribe();
      input.dispose();
      resize.dispose();
      terminal.dispose();
    };
  }, [session.id]);
  return (
    <div className="terminal-view">
      {error && <Notice error>{error}</Notice>}
      <div ref={host} className="terminal-surface" />
    </div>
  );
}
