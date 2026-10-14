export type ThemeMode = "dark" | "light";

// A member's choice is stored under their own key so it follows them across
// the app's screens; the unqualified key is the fallback for the signed-out
// screens, which have no member to read.
const SHARED_KEY = "buglens:theme";

function keyFor(userId?: string): string {
  return userId ? `${SHARED_KEY}:${userId}` : SHARED_KEY;
}

function asMode(value: string | null): ThemeMode | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

export function readTheme(userId?: string): ThemeMode {
  return asMode(localStorage.getItem(keyFor(userId))) ?? asMode(localStorage.getItem(SHARED_KEY)) ?? "dark";
}

export function writeTheme(mode: ThemeMode, userId?: string): void {
  localStorage.setItem(keyFor(userId), mode);
  if (userId) localStorage.setItem(SHARED_KEY, mode);
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
}
