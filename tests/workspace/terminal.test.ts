import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { TerminalService } from "../../src/main/terminal/service";
import { WorkspaceStore } from "../../src/main/workspace/store";

it.skipIf(process.platform !== "win32")(
  "uses a real Windows PTY, retains output, resizes, and owns shutdown",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "tommybrown-terminal-"));
    const store = await WorkspaceStore.open(join(directory, "state.json"));
    const state = await store.add(directory, "workspace");
    if (!state.selectedSpace) throw new Error("Missing space");
    const terminal = new TerminalService(
      store,
      async () => {
        throw new Error("Unexpected routed model");
      },
      () => undefined,
    );
    try {
      const session = await terminal.launch({
        spaceId: state.selectedSpace,
        cli: "powershell",
        model: null,
      });
      terminal.resize({ id: session.id, columns: 110, rows: 30 });
      terminal.write({
        id: session.id,
        data: "Write-Output ('tommybrown-' + 'pty-ready')\r",
      });
      await expect
        .poll(() => terminal.attach(session.id).data, { timeout: 10_000 })
        .toContain("tommybrown-pty-ready");
      expect(terminal.list()).toHaveLength(1);
      terminal.write({ id: session.id, data: "exit 7\r" });
      await expect
        .poll(() => terminal.list()[0]?.exitCode, { timeout: 5000 })
        .toBe(7);
      expect(() => terminal.write({ id: session.id, data: "ignored" })).toThrow(
        "exited",
      );
      await terminal.close(session.id);
      expect(terminal.list()).toEqual([]);
    } finally {
      await terminal.stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);
