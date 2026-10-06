import { join } from "node:path";
import { app, safeStorage, shell } from "electron";
import { z } from "zod";
import { browserGroupSchema } from "../../shared/browser";
import { isMcpConnector } from "../../shared/connectors";
import type { BrowserService } from "../browser/service";
import { ConnectorMcp } from "./mcp";
import { MemoryConnector } from "./memory";
import { ServiceOAuth } from "./oauth";
import { ConnectorStore } from "./store";

export async function registerConnectors(
  directory: string,
  browser: BrowserService,
  bind: (channel: string, action: (input: unknown) => unknown) => void,
  closeSessions: (id: string) => Promise<void>,
): Promise<{ store: ConnectorStore; mcp: ConnectorMcp; oauth: ServiceOAuth }> {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("OS credential encryption is required for connectors.");
  const store = await ConnectorStore.open(
    join(directory, "connectors.encrypted"),
    {
      encrypt: (text) => safeStorage.encryptString(text),
      decrypt: (buffer) => safeStorage.decryptString(buffer),
    },
  );
  const oauth = new ServiceOAuth(store, {
    openExternal: (url) => shell.openExternal(url),
  });
  const mcp = new ConnectorMcp(
    store,
    new MemoryConnector({
      directory: join(directory, "memory"),
      executable: process.execPath,
      script: join(app.getAppPath(), "dist", "main", "memory.cjs"),
    }),
    oauth,
  );
  bind("connectors:list", () => store.list());
  bind("connectors:add", (input) => store.add(input));
  bind("connectors:add-service", (input) => store.addService(input));
  bind("connectors:login", (input) => oauth.start(z.uuid().parse(input)));
  bind("connectors:login-status", (input) =>
    oauth.status(z.uuid().parse(input)),
  );
  bind("connectors:cancel-login", (input) =>
    oauth.cancel(z.uuid().parse(input)),
  );
  bind("connectors:set-tools", (input) => store.setTools(input));
  bind("connectors:open", (input) => {
    const request = z
      .object({ id: z.uuid(), group: browserGroupSchema })
      .parse(input);
    const connector = store.require(request.id);
    if (isMcpConnector(connector) || !connector.webUrl)
      throw new Error("MCP servers cannot be opened as web connectors.");
    return browser.open(connector.webUrl, connector.id, request.group);
  });
  bind("connectors:disconnect", async (input) => {
    const id = store.require(input).id;
    await oauth.cancel(id);
    await closeSessions(id);
    await browser.disconnect(id);
    return store.remove(id);
  });
  bind("connectors:check", (input) => mcp.check(z.uuid().parse(input)));
  bind("connectors:call", (input) => mcp.call(input));
  return { store, mcp, oauth };
}
