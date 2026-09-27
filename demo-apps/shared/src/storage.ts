export function getItem<T>(prefix: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(prefix: string, key: string, value: T): void {
  // The /reset route clears this prefix's keys in an effect, then calls
  // location.replace("/"). That navigation is asynchronous, so other
  // components' own persist-on-change effects (e.g. a state provider that
  // wraps the whole app) can still fire afterwards in the same commit and
  // write their last in-memory value straight back, undoing the reset.
  // Suppressing writes while /reset is the active path closes that race
  // regardless of effect ordering.
  if (typeof location !== "undefined" && location.pathname === "/reset") return;
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    /* storage unavailable, ignore */
  }
}

export function removeItem(prefix: string, key: string): void {
  try {
    localStorage.removeItem(prefix + key);
  } catch {
    /* ignore */
  }
}

export function resetApp(prefix: string): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  location.replace("/");
}
