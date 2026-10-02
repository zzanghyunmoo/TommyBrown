import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Cross2Icon,
  ExternalLinkIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "../../components/primitives";
import type { useBrowser } from "./use-browser";

export function BrowserPane({
  browser,
  visible,
}: {
  readonly browser: ReturnType<typeof useBrowser>;
  readonly visible: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const address = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const id = browser.selected?.id;
  const tab = browser.selected;
  useEffect(() => {
    if (!id || !host.current) return;
    const element = host.current;
    let active = true;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      void window.browser
        .bounds({
          id,
          rectangle:
            visible && bounds.width > 0 && bounds.height > 0
              ? {
                  x: Math.round(bounds.x),
                  y: Math.round(bounds.y),
                  width: Math.floor(bounds.width),
                  height: Math.floor(bounds.height),
                }
              : null,
        })
        .catch((failure: unknown) => {
          if (active && failure instanceof Error) setError(failure.message);
        });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      active = false;
      observer.disconnect();
      void window.browser
        .bounds({ id, rectangle: null })
        .catch(() => undefined);
    };
  }, [id, visible]);
  function navigate(fresh: boolean) {
    const url = address.current?.value;
    if (!url) return;
    void browser.run(() =>
      !fresh && tab
        ? window.browser.navigate(tab.id, url)
        : window.browser.open(url),
    );
  }
  return (
    <section className="browser-pane" aria-label="내장 브라우저">
      <div className="browser-tabs" role="tablist" aria-label="브라우저 탭">
        {browser.state.tabs.map((item) => (
          <div className="browser-tab" key={item.id}>
            <button
              type="button"
              role="tab"
              aria-selected={item.id === tab?.id}
              onClick={() => {
                void browser.run(() => window.browser.select(item.id));
              }}
            >
              {item.title}
            </button>
            <button
              type="button"
              aria-label={`${item.title} 웹 탭 닫기`}
              onClick={() => {
                void browser.run(() => window.browser.close(item.id));
              }}
            >
              <Cross2Icon />
            </button>
          </div>
        ))}
      </div>
      <form
        className="browser-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(false);
        }}
      >
        <Button
          tone="quiet"
          disabled={!tab?.back}
          aria-label="뒤로"
          onClick={() => {
            if (tab)
              void browser.run(() => window.browser.action(tab.id, "back"));
          }}
        >
          <ArrowLeftIcon />
        </Button>
        <Button
          tone="quiet"
          disabled={!tab?.forward}
          aria-label="앞으로"
          onClick={() => {
            if (tab)
              void browser.run(() => window.browser.action(tab.id, "forward"));
          }}
        >
          <ArrowRightIcon />
        </Button>
        <Button
          tone="quiet"
          disabled={!tab}
          aria-label="다시 로드"
          onClick={() => {
            if (tab)
              void browser.run(() => window.browser.action(tab.id, "reload"));
          }}
        >
          <ReloadIcon />
        </Button>
        <input
          key={tab?.url ?? "new"}
          ref={address}
          type="text"
          defaultValue={tab?.url ?? "https://"}
          aria-label="웹 주소"
          spellCheck={false}
        />
        <Button type="submit">이동</Button>
        <Button
          tone="quiet"
          aria-label="새 웹 탭"
          onClick={() => navigate(true)}
        >
          <PlusIcon />
        </Button>
        <Button
          tone="quiet"
          disabled={!tab}
          aria-label="외부 브라우저로 열기"
          onClick={() => {
            if (tab)
              void browser.run(() => window.browser.action(tab.id, "external"));
          }}
        >
          <ExternalLinkIcon />
        </Button>
      </form>
      {(browser.error || error) && (
        <Notice error>{browser.error || error}</Notice>
      )}
      {tab?.error && <Notice error>{tab.error}</Notice>}
      {!tab && (
        <div className="editor-empty">
          <h2>작업 옆에서 웹 열기</h2>
          <p>주소를 입력하거나 터미널의 링크를 클릭하세요.</p>
        </div>
      )}
      <div className="browser-host" ref={host} />
      {tab && (
        <footer className="browser-status">
          {tab.phase === "loading" ? "불러오는 중…" : new URL(tab.url).hostname}
          <span>로그인이 차단되면 외부 브라우저로 여세요.</span>
        </footer>
      )}
    </section>
  );
}
