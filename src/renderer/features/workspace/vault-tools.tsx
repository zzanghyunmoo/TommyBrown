import { useState } from "react";
import type { VaultSearchResult } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";

export function VaultTools({
  spaceId,
  open,
}: {
  readonly spaceId: string;
  readonly open: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<VaultSearchResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function search() {
    setBusy(true);
    setError(undefined);
    try {
      setResult(await window.workspace.searchVault({ spaceId, query }));
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="vault-tools" aria-label="오프라인 보관함">
      <span className="eyebrow">OFFLINE VAULT</span>
      <Button
        tone="quiet"
        onClick={() => {
          void window.workspace
            .openObsidian({ spaceId, path: "" })
            .catch((failure: unknown) => {
              if (failure instanceof Error) setError(failure.message);
            });
        }}
      >
        Obsidian 앱 열기
      </Button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <input
          aria-label="보관함 검색어"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="노트 검색"
          maxLength={200}
        />
        <Button type="submit" busy={busy} disabled={!query.trim()}>
          검색
        </Button>
      </form>
      {error && <Notice error>{error}</Notice>}
      {result && (
        <>
          <p role="status">
            <span>{result.matches.length}개 결과</span>
            <br />
            <span>{result.scanned}개 노트 확인</span>
          </p>
          {(result.limited || result.skipped > 0) && (
            <p>
              검색 한도 또는 읽지 못한 파일이 있습니다. 건너뜀: {result.skipped}
            </p>
          )}
          {result.matches.map((match) => (
            <button
              className="vault-result"
              type="button"
              key={match.path}
              onClick={() => open(match.path)}
            >
              <strong>
                {match.path}:{match.line}
              </strong>
              <span>{match.excerpt}</span>
            </button>
          ))}
        </>
      )}
    </section>
  );
}
