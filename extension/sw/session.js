// Per-tab Session in chrome.storage.session (survives page loads and SW
// restarts, cleared when the browser closes).

function key(tabId) {
  return `session:${tabId}`;
}

export async function getSession(tabId) {
  const result = await chrome.storage.session.get(key(tabId));
  return result[key(tabId)] ?? null;
}

export async function saveSession(session) {
  await chrome.storage.session.set({ [key(session.tabId)]: session });
}

// Every read-modify-write of a tab's session goes through this per-tab queue,
// so two messages handled at the same time (e.g. STEP_RESULT and HELLO) can
// never overwrite each other's changes.
const locks = new Map(); // tabId -> Promise

function withLock(tabId, fn) {
  const prev = locks.get(tabId) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(tabId, next.catch(() => {}));
  return next;
}

// Reads the session, calls mutate(session). If mutate returns false, nothing
// is saved and null is returned; otherwise the mutated session is saved and
// returned. Returns null when there is no session.
export function updateSession(tabId, mutate) {
  return withLock(tabId, async () => {
    const session = await getSession(tabId);
    if (!session) return null;
    if (mutate(session) === false) return null;
    await saveSession(session);
    return session;
  });
}

export function replaceSession(session) {
  return withLock(session.tabId, () => saveSession(session));
}

export function clearSession(tabId) {
  return withLock(tabId, () => chrome.storage.session.remove(key(tabId)));
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearSession(tabId)
    .then(() => locks.delete(tabId))
    .catch((err) => console.error("[Pointr:sw] clearSession on tab removal failed", err));
});
