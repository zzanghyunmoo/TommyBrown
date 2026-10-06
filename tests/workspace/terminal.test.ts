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
    let activeLeases = 0;
    let disposals = 0;
    const terminal = new TerminalService(
      store,
      {
        connectors: async () => {
          activeLeases++;
          let disposed = false;
          return {
            profile: () => ({ args: [], environment: {} }),
            revoke: () => undefined,
            dispose: async () => {
              if (disposed) return;
              disposed = true;
              activeLeases--;
              disposals++;
            },
          };
        },
        model: async () => {
          throw new Error("Unexpected routed model");
        },
      },
      () => undefined,
    );
    try {
      const session = await terminal.launch({
        spaceId: state.selectedSpace,
        cli: "powershell",
        model: null,
      });
      expect(activeLeases).toBe(1);
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
      await expect.poll(() => activeLeases).toBe(0);
      expect(disposals).toBe(1);
      expect(() => terminal.write({ id: session.id, data: "ignored" })).toThrow(
        "exited",
      );
      await terminal.close(session.id);
      expect(terminal.list()).toEqual([]);
      await expect(
        terminal.launch({
          spaceId: state.selectedSpace,
          cli: "claude",
          model: "fixture",
        }),
      ).rejects.toThrow("Unexpected routed model");
      expect(activeLeases).toBe(0);
      expect(disposals).toBe(2);
    } finally {
      await terminal.stop();
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);
