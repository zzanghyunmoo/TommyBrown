import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker&inline";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import { useEffect, useLayoutEffect, useRef } from "react";
import { currentTheme, subscribeTheme, themeColor } from "../../theme";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
function applyEditorTheme(): string {
  const name = `tommybrown-${currentTheme()}`;
  monaco.editor.defineTheme(name, {
    base: currentTheme() === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": themeColor("--paper"),
      "editor.foreground": themeColor("--ink"),
      "editor.lineHighlightBackground": themeColor("--wash"),
      "editorLineNumber.foreground": themeColor("--muted"),
      "editorLineNumber.activeForeground": themeColor("--ink"),
      "editor.selectionBackground": themeColor("--selection"),
    },
  });
  monaco.editor.setTheme(name);
  return name;
}

function language(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "ts" || extension === "tsx") return "typescript";
  if (extension === "js" || extension === "jsx" || extension === "mjs")
    return "javascript";
  if (extension === "md" || extension === "mdx") return "markdown";
  if (extension === "py") return "python";
  return "plaintext";
}

export function CodeEditor({
  path,
  initialValue,
  change,
  save,
}: {
  readonly path: string;
  readonly initialValue: string;
  readonly change: (value: string) => void;
  readonly save: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const initial = useRef(initialValue);
  const callbacks = useRef({ change, save });
  useLayoutEffect(() => {
    callbacks.current = { change, save };
  }, [change, save]);
  useEffect(() => {
    if (!host.current) return;
    const editor = monaco.editor.create(host.current, {
      value: initial.current,
      language: language(path),
      theme: applyEditorTheme(),
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: "Consolas, monospace",
      fontSize: 13,
      tabSize: 2,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      ariaLabel: `문서 편집기 ${path}`,
      padding: { top: 12 },
    });
    const subscription = editor.onDidChangeModelContent(() =>
      callbacks.current.change(editor.getValue()),
    );
    const unsubscribeTheme = subscribeTheme(applyEditorTheme);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      callbacks.current.save(),
    );
    return () => {
      subscription.dispose();
      unsubscribeTheme();
      editor.getModel()?.dispose();
      editor.dispose();
    };
  }, [path]);
  return <div className="code-editor" ref={host} />;
}
