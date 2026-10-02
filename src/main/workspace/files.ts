import { createHash, randomUUID } from "node:crypto";
import {
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  type FileEntry,
  type FileRequest,
  fileRequestSchema,
  saveRequestSchema,
  type TextDocument,
} from "../../shared/workspace";
import type { WorkspaceStore } from "./store";

const MAX_BYTES = 2 * 1024 * 1024;
const hiddenDirectories = new Set([".git", "node_modules"]);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export class WorkspaceFiles {
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly store: WorkspaceStore) {}

  async list(input: unknown): Promise<readonly FileEntry[]> {
    const request = fileRequestSchema.parse(input);
    const path = await this.resolve(request);
    const entries = await readdir(path, { withFileTypes: true });
    if (entries.length > 2000)
      throw new Error(
        "This directory is too large to browse. Open a smaller space.",
      );
    return entries
      .filter(
        (entry) =>
          !entry.isSymbolicLink() &&
          !hiddenDirectories.has(entry.name) &&
          (entry.isDirectory() || entry.isFile()),
      )
      .map(
        (entry): FileEntry => ({
          name: entry.name,
          path: [request.path, entry.name].filter(Boolean).join("/"),
          kind: entry.isDirectory() ? "directory" : "file",
        }),
      )
      .sort((a, b) =>
        a.kind === b.kind
          ? a.name.localeCompare(b.name)
          : a.kind === "directory"
            ? -1
            : 1,
      );
  }

  async read(input: unknown): Promise<TextDocument> {
    const request = fileRequestSchema.parse(input);
    if (!request.path) throw new Error("Select a text file.");
    const path = await this.resolve(request);
    const bytes = await this.readBytes(path);
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("This file is not UTF-8 text.");
    }
    if (content.includes("\0"))
      throw new Error("Binary files cannot be opened as text.");
    return { ...request, content, version: hash(bytes) };
  }

  save(input: unknown): Promise<TextDocument> {
    const operation = this.writes.then(async () => {
      const request = saveRequestSchema.parse(input);
      const bytes = Buffer.from(request.content, "utf8");
      if (bytes.length > MAX_BYTES || request.content.includes("\0"))
        throw new Error("The document is too large or is not text.");
      const current = await this.read(request);
      if (current.version !== request.version)
        throw new Error(
          "The file changed outside TommyBrown. Reopen it before saving.",
        );
      const path = await this.resolve(request);
      const metadata = await stat(path);
      const temporary = join(
        dirname(path),
        `.${basename(path)}.${randomUUID()}.tmp`,
      );
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: metadata.mode });
        if (hash(await this.readBytes(path)) !== request.version)
          throw new Error(
            "The file changed while saving. Your draft has been kept.",
          );
        if ((await this.resolve(request)) !== path)
          throw new Error("The file location changed while saving.");
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
      return {
        spaceId: request.spaceId,
        path: request.path,
        content: request.content,
        version: hash(bytes),
      };
    });
    this.writes = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async resolve(request: FileRequest): Promise<string> {
    const parts = request.path.split("/");
    if (
      isAbsolute(request.path) ||
      /[\\:\0]/.test(request.path) ||
      parts.some(
        (part) =>
          part === ".." || part === "." || part.toLowerCase() === ".git",
      )
    )
      throw new Error("This path is outside the selected space.");
    const root = await realpath(this.store.requireSpace(request.spaceId).root);
    const path = await realpath(join(root, ...parts));
    const remainder = relative(root, path);
    if (
      isAbsolute(remainder) ||
      remainder === ".." ||
      remainder.startsWith(`..${sep}`)
    )
      throw new Error("This path is outside the selected space.");
    return path;
  }

  private async readBytes(path: string): Promise<Buffer> {
    const file = await open(path, "r");
    try {
      const metadata = await file.stat();
      if (!metadata.isFile()) throw new Error("Select a regular text file.");
      if (metadata.size > MAX_BYTES)
        throw new Error("This file is too large to edit (limit 2 MiB).");
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await file.read(
          buffer,
          total,
          buffer.length - total,
          total,
        );
        if (bytesRead === 0) break;
        total += bytesRead;
      }
      if (total > MAX_BYTES)
        throw new Error("This file is too large to edit (limit 2 MiB).");
      return buffer.subarray(0, total);
    } finally {
      await file.close();
    }
  }
}
