import type { ReactNode } from "react";

export function ModeTabs<T extends string>({
  label,
  items,
  selected,
  select,
  children,
}: {
  readonly label: string;
  readonly items: readonly {
    readonly id: T;
    readonly label: string;
    readonly panel: string;
    readonly icon?: ReactNode;
  }[];
  readonly selected: T;
  readonly select: (id: T) => void;
  readonly children?: ReactNode;
}) {
  return (
    <div className="pane-tabbar">
      <div className="pane-mode-tabs" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected === item.id}
            aria-controls={item.panel}
            tabIndex={selected === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : event.key === "ArrowRight"
                      ? (index + 1) % items.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + items.length) % items.length
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              const target = items[next];
              if (target) select(target.id);
              (
                event.currentTarget.parentElement?.children[next] as
                  | HTMLButtonElement
                  | undefined
              )?.focus();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
