import { chmod, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.platform === "darwin") {
  const require = createRequire(import.meta.url);
  const helper = join(
    dirname(require.resolve("node-pty/package.json")),
    "prebuilds",
    `darwin-${process.arch}`,
    "spawn-helper",
  );
  const before = (await stat(helper)).mode & 0o777;
  await chmod(helper, 0o755);
  console.log(`node-pty spawn-helper mode: ${before.toString(8)} -> 755`);
}
