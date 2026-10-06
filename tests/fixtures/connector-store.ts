import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConnectorStore,
  type SecretCodec,
} from "../../src/main/connectors/store";

export async function encryptedStore() {
  const directory = await mkdtemp(join(tmpdir(), "tommybrown-service-"));
  const path = join(directory, "store.enc");
  const key = randomBytes(32);
  const codec: SecretCodec = {
    encrypt(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    },
    decrypt(buffer) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        buffer.subarray(0, 12),
      );
      decipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([
        decipher.update(buffer.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
  return {
    path,
    codec,
    store: await ConnectorStore.open(path, codec),
    close: () => rm(directory, { recursive: true, force: true }),
  };
}
