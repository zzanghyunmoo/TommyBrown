import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { safeStorage } from "electron";
import { GatewayError } from "../shared/proxy";
import { protectPrivateDirectory } from "./private-directory";
import { createProxyKeys, proxyKeysSchema } from "./proxy/config";

export async function loadGatewayKeys(directory: string) {
  if (!safeStorage.isEncryptionAvailable())
    throw new GatewayError(
      "configuration",
      "OS credential encryption is unavailable. Unlock your user session and restart TommyBrown.",
    );
  const path = join(directory, "gateway-keys.encrypted");
  await protectPrivateDirectory(directory);
  try {
    const bytes = await readFile(path);
    return proxyKeysSchema.parse(JSON.parse(safeStorage.decryptString(bytes)));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
    const keys = createProxyKeys();
    await writeFile(path, safeStorage.encryptString(JSON.stringify(keys)), {
      mode: 0o600,
      flag: "wx",
    });
    return keys;
  }
}
