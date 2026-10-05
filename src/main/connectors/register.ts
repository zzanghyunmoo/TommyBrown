import { join } from "node:path";
import { safeStorage } from "electron";
import { z } from "zod";
import { browserGroupSchema } from "../../shared/browser";
import type { BrowserService } from "../browser/service";
import { ConnectorMcp } from "./mcp";
import { ConnectorStore } from "./store";

export async function registerConnectors(
  directory: string,
  browser: BrowserService,
  bind: (channel: string, action: (input: unknown) => unknown) => void,
  closeSessions: (id: string) => Promise<void>,
): Promise<ConnectorStore> {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("OS credential encryption is required for connectors.");
  const store = await ConnectorStore.open(
    join(directory, "connectors.encrypted"),
    {
      encrypt: (text) => safeStorage.encryptString(text),
      decrypt: (buffer) => safeStorage.decryptString(buffer),
    },
  );
  const mcp = new ConnectorMcp(store);
  bind("connectors:list", () => store.list());
  bind("connectors:add", (input) => store.add(input));
  bind("connectors:open", (input) => {
    const request = z
      .object({ id: z.uuid(), group: browserGroupSchema })
      .parse(input);
    const connector = store.require(request.id);
    return browser.open(connector.webUrl, connector.id, request.group);
  });
  bind("connectors:disconnect", async (input) => {
    const id = store.require(input).id;
    await closeSessions(id);
    await browser.disconnect(id);
    return store.remove(id);
  });
  bind("connectors:check", (input) => mcp.check(z.uuid().parse(input)));
  bind("connectors:call", (input) => mcp.call(input));
  return store;
}
