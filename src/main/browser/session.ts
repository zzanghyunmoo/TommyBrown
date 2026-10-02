import { type Session, session } from "electron";
import { z } from "zod";

const configured = new WeakSet<Session>();
export function browserSession(connectorId: string | null): Session {
  const partition = session.fromPartition(
    connectorId === null
      ? "persist:tommybrown-browser"
      : `persist:tommybrown-connector-${z.uuid().parse(connectorId)}`,
  );
  if (!configured.has(partition)) {
    partition.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    partition.setPermissionCheckHandler(() => false);
    partition.on("will-download", (event) => event.preventDefault());
    configured.add(partition);
  }
  return partition;
}
