import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { themeSchema } from "../../shared/appearance";
import { changeTheme, currentTheme, subscribeTheme } from "../theme";

export function ThemeChoice({
  report,
}: {
  readonly report: (error: string | undefined) => void;
}) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLSelectElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (busy || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body && document.hasFocus())
      field.current?.focus();
  }, [busy]);
  return (
    <label className="theme-choice">
      {theme === "dark" ? (
        <MoonIcon aria-hidden="true" />
      ) : (
        <SunIcon aria-hidden="true" />
      )}
      <select
        ref={field}
        aria-label="화면 테마"
        value={theme}
        disabled={busy}
        onChange={(event) => {
          const next = themeSchema.parse(event.target.value);
          restoreFocus.current = document.activeElement === event.currentTarget;
          setBusy(true);
          void changeTheme(next)
            .then(() => report(undefined))
            .catch(() =>
              report("화면 테마를 저장하지 못했습니다. 다시 선택해 주세요."),
            )
            .finally(() => setBusy(false));
        }}
      >
        <option value="light">Bright</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
