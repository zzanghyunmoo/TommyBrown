import { Cross2Icon, EyeOpenIcon, FileTextIcon } from "@radix-ui/react-icons";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Space } from "../../../shared/workspace";
import { Button, Notice } from "../../components/primitives";
import { CodeEditor } from "./code-editor";
import { FileTree } from "./file-tree";
import type { PaneHandle } from "./pane-handle";
import { type Draft, keyOf, useDocumentRestore } from "./use-document-restore";

export function DocumentPane({
  space,
  openUrl,
  ref,
}: {
  readonly space: Space;
  readonly openUrl: (url: string) => void;
  readonly ref?: Ref<PaneHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const {
    documents,
    setDocuments,
    selected,
    setSelected,
    preview,
    setPreview,
    restoreError,
    ready,
  } = useDocumentRestore();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const opening = useRef(0);
  const visible = documents.filter((doc) => doc.spaceId === space.id);
  const current = visible.find((doc) => keyOf(doc) === selected) ?? visible[0];
  const dirty = documents.some((doc) => doc.draft !== doc.content);
  useEffect(() => {
    void window.workspace.setDirty(dirty);
  }, [dirty]);
  async function open(path: string) {
    if (!ready) return;
    const token = ++opening.current;
    setError(undefined);
    const existing = documents.find(
      (doc) => doc.spaceId === space.id && doc.path === path,
    );
    if (existing) {
      setSelected(keyOf(existing));
      return;
    }
    if (documents.length >= 32) {
      setError(
        "새 문서를 열려면 기존 탭을 닫아주세요. 최대 32개까지 열 수 있습니다.",
      );
      return;
    }
    try {
      const doc = await window.workspace.read({ spaceId: space.id, path });
      setDocuments((previous) =>
        previous.some((candidate) => keyOf(candidate) === keyOf(doc))
          ? previous
          : [...previous, { ...doc, draft: doc.content }],
      );
      if (opening.current === token) {
        setSelected(keyOf(doc));
        setPreview(false);
      }
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    }
  }
  async function save() {
    if (!current || saving) return;
    const target = current;
    setSaving(true);
    setError(undefined);
    try {
      const result = await window.workspace.save({
        spaceId: target.spaceId,
        path: target.path,
        content: target.draft,
        version: target.version,
      });
      setDocuments((previous) =>
        previous.map((doc) =>
          keyOf(doc) === keyOf(target)
            ? { ...doc, content: result.content, version: result.version }
            : doc,
        ),
      );
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    } finally {
      setSaving(false);
    }
  }
  function close(doc: Draft) {
    if (
      doc.draft !== doc.content &&
      !window.confirm("저장하지 않은 변경 사항을 버리고 닫을까요?")
    )
      return;
    setDocuments((previous) =>
      previous.filter((candidate) => keyOf(candidate) !== keyOf(doc)),
    );
  }
  function focus() {
    const element =
      host.current?.querySelector<HTMLElement>(".monaco-editor textarea") ??
      host.current?.querySelector<HTMLElement>(".markdown-preview") ??
      host.current?.querySelector<HTMLElement>("button");
    element?.focus();
  }
  function selectTab(index: number) {
    const doc = visible[index];
    if (doc) {
      setSelected(keyOf(doc));
      requestAnimationFrame(focus);
    }
  }
  useImperativeHandle(ref, () => ({
    focus,
    newTab: () =>
      host.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    closeTab: () => {
      if (current) close(current);
    },
    selectTab,
    cycleTab: (offset) => {
      if (current)
        selectTab(
          (visible.indexOf(current) + offset + visible.length) % visible.length,
        );
    },
  }));
  return (
    <div ref={host} className="document-pane">
      <FileTree
        key={space.id}
        space={space}
        open={(path) => {
          void open(path);
        }}
      />
      <section className="document-editor" aria-label="문서 작업 영역">
        <div className="document-tabs" role="tablist" aria-label="열린 문서">
          {visible.map((doc) => (
            <div className="document-tab" key={keyOf(doc)}>
              <button
                type="button"
                role="tab"
                aria-selected={current === doc}
                onClick={() => setSelected(keyOf(doc))}
              >
                <FileTextIcon />
                {doc.path.split("/").pop()}
                {doc.draft !== doc.content && (
                  <span role="img" aria-label="저장하지 않음">
                    ●
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => close(doc)}
                aria-label={`${doc.path} 닫기`}
              >
                <Cross2Icon />
              </button>
            </div>
          ))}
        </div>
        {error && <Notice error>{error}</Notice>}
        {restoreError && <Notice error>{restoreError}</Notice>}
        {!ready && <Notice>문서를 복원하는 중…</Notice>}
        {current ? (
          <>
            <div className="editor-toolbar">
              <span title={current.path}>{current.path}</span>
              <Button
                tone="quiet"
                onClick={() => setPreview((value) => !value)}
                disabled={!/\.mdx?$/i.test(current.path)}
              >
                <EyeOpenIcon />
                {preview ? "편집" : "미리보기"}
              </Button>
              <Button
                busy={saving}
                disabled={current.content === current.draft}
                onClick={() => {
                  void save();
                }}
              >
                저장
              </Button>
            </div>
            {preview && /\.mdx?$/i.test(current.path) ? (
              <article className="markdown-preview" tabIndex={-1}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    img: ({ alt }) => <span>{alt ?? "이미지"}</span>,
                    a: ({ children, href }) => (
                      <button
                        type="button"
                        className="markdown-link"
                        onClick={() => {
                          if (!href || !current) return;
                          if (/^https?:\/\//i.test(href)) {
                            openUrl(href);
                            return;
                          }
                          if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
                            setError("지원하지 않는 링크 형식입니다.");
                            return;
                          }
                          try {
                            const path = current.path
                              .split("/")
                              .map(encodeURIComponent)
                              .join("/");
                            const target = new URL(
                              href,
                              `https://workspace.invalid/${path}`,
                            );
                            if (target.hostname !== "workspace.invalid") {
                              setError("공간 밖의 링크입니다.");
                              return;
                            }
                            void open(
                              decodeURIComponent(target.pathname).slice(1),
                            );
                          } catch {
                            setError("올바르지 않은 문서 링크입니다.");
                          }
                        }}
                      >
                        {children}
                      </button>
                    ),
                  }}
                >
                  {current.draft}
                </Markdown>
              </article>
            ) : (
              <CodeEditor
                key={keyOf(current)}
                path={current.path}
                initialValue={current.draft}
                change={(value) =>
                  setDocuments((previous) =>
                    previous.map((doc) =>
                      keyOf(doc) === keyOf(current)
                        ? { ...doc, draft: value }
                        : doc,
                    ),
                  )
                }
                save={() => {
                  void save();
                }}
              />
            )}
          </>
        ) : (
          <div className="editor-empty">
            <FileTextIcon width={32} height={32} />
            <h2>문서를 열어 작업을 이어가세요</h2>
            <p>왼쪽 파일 목록에서 코드나 Markdown 문서를 선택하세요.</p>
          </div>
        )}
      </section>
    </div>
  );
}
