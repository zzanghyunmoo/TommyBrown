import { clipboard } from "electron";
import { z } from "zod";
import type { TerminalService } from "./service";

export function registerTerminals(
  terminals: TerminalService,
  bind: (channel: string, action: (input: unknown) => unknown) => void,
) {
  bind("terminal:launch", (input) => terminals.launch(input));
  bind("terminal:list", () => terminals.list());
  bind("terminal:attach", (input) => terminals.attach(z.uuid().parse(input)));
  bind("terminal:write", (input) => terminals.write(input));
  bind("terminal:resize", (input) => terminals.resize(input));
  bind("terminal:close", (input) => terminals.close(z.uuid().parse(input)));
  bind("terminal:clipboard-read", async () =>
    z
      .string()
      .max(65524, "붙여넣기는 한 번에 65,524자까지 가능합니다.")
      .parse(await clipboard.readText()),
  );
  bind("terminal:clipboard-write", (input) =>
    clipboard.writeText(z.string().max(1_000_000).parse(input)),
  );
}
