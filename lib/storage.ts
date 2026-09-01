// Safari private mode throws SecurityError on any localStorage access.
// Use these helpers everywhere instead of window.localStorage directly.

export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore — private mode or storage quota exceeded
  }
}

export function lsRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
