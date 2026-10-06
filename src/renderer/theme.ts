import { type Theme, themeSchema } from "../shared/appearance";

let theme: Theme = "light";
const listeners = new Set<() => void>();

function apply(next: Theme): void {
  theme = next;
  document.documentElement.dataset["theme"] = theme;
  for (const listener of listeners) listener();
}

export function currentTheme(): Theme {
  return theme;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initializeTheme(): Promise<void> {
  apply(themeSchema.parse(await window.appearance.get()));
}

export async function changeTheme(next: Theme): Promise<void> {
  apply(themeSchema.parse(await window.appearance.set(next)));
}

export function themeColor(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}
