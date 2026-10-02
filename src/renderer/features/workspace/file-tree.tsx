import {
  ArchiveIcon,
  ChevronRightIcon,
  FileTextIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useState } from "react";
import type { FileEntry, Space } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";
import { VaultTools } from "./vault-tools";

export function FileTree({
  space,
  open,
}: {
  readonly space: Space;
  readonly open: (path: string) => void;
}) {
  const [directory, setDirectory] = useState({ path: "" });
  const [entries, setEntries] = useState<readonly FileEntry[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setError(undefined);
    window.workspace
      .list({ spaceId: space.id, path: directory.path })
      .then((next) => {
        if (active) setEntries(next);
      })
      .catch((failure: unknown) => {
        if (active && failure instanceof Error) {
          setError(failure.message);
          setEntries([]);
        }
      });
    return () => {
      active = false;
    };
  }, [space.id, directory]);
  const up = useCallback(
    () =>
      setDirectory((current) => ({
        path: current.path.split("/").slice(0, -1).join("/"),
      })),
    [],
  );
  return (
    <section className="file-explorer" aria-label="파일 탐색기">
      {space.kind === "vault" && (
        <VaultTools key={space.id} spaceId={space.id} open={open} />
      )}
      <header className="pane-heading">
        <strong>파일</strong>
        <Button
          tone="quiet"
          onClick={() => setDirectory((current) => ({ ...current }))}
          aria-label="파일 목록 새로고침"
        >
          <ReloadIcon />
        </Button>
      </header>
      <div className="file-location" title={directory.path || space.name}>
        {directory.path || space.name}
      </div>
      {directory.path && (
        <button className="tree-row" type="button" onClick={up}>
          .. 상위 폴더
        </button>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="tree-entries">
        {entries.map((entry) => (
          <button
            type="button"
            className="tree-row"
            key={entry.path}
            title={entry.name}
            onClick={() =>
              entry.kind === "directory"
                ? setDirectory({ path: entry.path })
                : open(entry.path)
            }
          >
            {entry.kind === "directory" ? <ArchiveIcon /> : <FileTextIcon />}
            <span>{entry.name}</span>
            {entry.kind === "directory" && <ChevronRightIcon />}
          </button>
        ))}
      </div>
      {!entries.length && !error && (
        <p className="pane-empty">이 폴더에 표시할 파일이 없습니다.</p>
      )}
    </section>
  );
}
