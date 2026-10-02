import { useEffect, useState } from "react";
import type { TextDocument } from "../../../shared/workspace";
import { readViewState, saveViewState } from "./view-state";

export type Draft = TextDocument & { readonly draft: string };
export const keyOf = (doc: TextDocument) => `${doc.spaceId}:${doc.path}`;
export function useDocumentRestore() {
  const [initial] = useState(readViewState);
  const [documents, setDocuments] = useState<readonly Draft[]>([]);
  const [selected, setSelected] = useState<string | null>(
    initial.selectedDocument,
  );
  const [preview, setPreview] = useState(initial.preview);
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.allSettled(
      initial.documents.map((request) => window.workspace.read(request)),
    ).then((results) => {
      if (!active) return;
      const restored = results.flatMap((result) =>
        result.status === "fulfilled"
          ? [{ ...result.value, draft: result.value.content }]
          : [],
      );
      setDocuments((current) => [
        ...current,
        ...restored.filter(
          (doc) => !current.some((item) => keyOf(item) === keyOf(doc)),
        ),
      ]);
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failed)
        setError(
          `${failed}개 문서를 다시 열지 못했습니다. 파일의 위치와 접근 권한을 확인하세요.`,
        );
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [initial]);
  useEffect(() => {
    if (!ready) return;
    try {
      saveViewState({
        documents: documents.map(({ spaceId, path }) => ({ spaceId, path })),
        selectedDocument: selected,
        preview,
      });
    } catch {
      setError("열린 문서 정보를 저장하지 못했습니다.");
    }
  }, [documents, selected, preview, ready]);
  return {
    documents,
    setDocuments,
    selected,
    setSelected,
    preview,
    setPreview,
    restoreError: error,
    ready,
  };
}
