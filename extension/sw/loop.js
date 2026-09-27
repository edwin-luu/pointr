// The step loop (ARCHITECTURE section 5):
// observing -> thinking -> awaiting_action -> settling -> (checkin) -> observing ...
import { getSession, updateSession, replaceSession, clearSession } from "./session.js";
import { captureWithMarks } from "./marks.js";
import { requestNextStep } from "./api.js";

const MAX_TURNS = 40;
const OFF_PATH_LIMIT = 3;
const HISTORY_SENT = 12;

function log(...args) {
  console.log("[Pointr:sw]", ...args);
}

// Only one loop iteration may be in flight per tab. Every runTurn takes a new
// token; an older run that wakes up from an await with a stale token stops.
const runTokens = new Map(); // tabId -> number

function newRunToken(tabId) {
  const token = (runTokens.get(tabId) || 0) + 1;
  runTokens.set(tabId, token);
  return token;
}

// Stops whatever run is in flight for this tab (its results are discarded).
export function cancelRuns(tabId) {
  newRunToken(tabId);
  waitingForActiveTab.delete(tabId);
}

// Predicted-step fast path (ARCHITECTURE 12.3): when the previous answer
// predicted this step, point at it right after the capture, while the model
// is still thinking.
const normalizeLabel = (label) => (label || "").toLowerCase().replace(/\s+/g, " ").trim();

// The provisional Step for this turn, or null: the last outcome must be
// "completed" and exactly one scanned element must have the predicted role
// and (normalized) label.
function provisionalFrom(session, elements) {
  const p = session.predicted;
  const last = session.history[session.history.length - 1];
  if (!p || !last || last.outcome !== "completed") return null;
  const want = normalizeLabel(p.label);
  const matches = elements.filter((el) => el.role === p.role && normalizeLabel(el.label) === want);
  if (matches.length !== 1) return null;
  return {
    step: {
      reasoning: "predicted by the previous turn",
      action: p.action,
      elementId: matches[0].id,
      scrollDirection: null,
      instruction: p.instruction,
      confidence: "medium",
      done: false,
    },
    element: matches[0],
  };
}

// Tabs whose turn is paused because they are not the visible tab
// (captureVisibleTab would shoot whatever tab IS visible).
const waitingForActiveTab = new Set();

// Resolves to the content script's reply, or { ok:false, reason:"no_content_script" }
// when the page has no content script right now (it is loading or navigating).
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, reason: "no_content_script", error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    } catch (err) {
      resolve({ ok: false, reason: "no_content_script", error: String(err) });
    }
  });
}

export async function startSession(tabId, goal) {
  cancelRuns(tabId);
  await replaceSession({
    sessionId: crypto.randomUUID(),
    tabId,
    goal,
    status: "observing",
    turn: 1,
    history: [],
    currentStep: null,
    currentElementLabel: null,
    offPathStreak: 0,
    predicted: null,
    startedAt: Date.now(),
    stepUrl: null,
    outcomeAt: null,
  });
  log(`t1 start "${goal}" in tab ${tabId}`);
  await runTurn(tabId);
}

export async function stopSession(tabId) {
  cancelRuns(tabId);
  await clearSession(tabId);
  await sendToTab(tabId, { type: "POINTR_ENDED" });
}

// OBSERVING -> THINKING -> AWAITING_ACTION (or DONE / error) for the current turn.
export async function runTurn(tabId) {
  const token = newRunToken(tabId);
  waitingForActiveTab.delete(tabId);
  const isLive = () => runTokens.get(tabId) === token;

  let settleMs;
  const s0 = await updateSession(tabId, (s) => {
    if (!isLive()) return false;
    if (s.outcomeAt) settleMs = Date.now() - s.outcomeAt;
    s.outcomeAt = null;
    s.status = "observing";
  });
  if (!s0) return;
  const turn = s0.turn;

  if (turn > MAX_TURNS) {
    log(`t${turn} hit the ${MAX_TURNS}-turn cap`);
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, {
      type: "POINTR_ERROR",
      message: "This is taking longer than expected. Let's start over.",
      retryable: false,
    });
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab closed
  }
  if (!isLive()) return;
  if (!tab.active) {
    log(`t${turn} tab ${tabId} is in the background, resuming when it is shown`);
    waitingForActiveTab.add(tabId);
    return;
  }

  // 1. Scan (content hides ALL Pointr UI first and keeps it hidden).
  const scanStart = performance.now();
  const scan = await sendToTab(tabId, { type: "POINTR_PREPARE_CAPTURE", turn });
  const scanMs = Math.round(performance.now() - scanStart);
  if (!isLive()) return;
  if (scan && scan.reason === "no_content_script") {
    log(`t${turn} no content script yet, waiting for POINTR_HELLO`);
    return;
  }
  if (!scan || !scan.page) {
    await fail(tabId, isLive, turn, "Lost contact with the page. Try reloading it.", true, scan && scan.error);
    return;
  }

  // 2. Screenshot + marks, while the UI is STILL hidden (capture-order rule).
  let shot;
  try {
    shot = await captureWithMarks(tab.windowId, scan.page, scan.elements);
  } catch (err) {
    if (!isLive()) return;
    await fail(tabId, isLive, turn, "Could not capture the screen. Try again.", true, err);
    return;
  }
  if (!isLive()) return;

  // 3. Un-hide the UI only now: either point at the predicted step at once
  // (the user can act on it while the model thinks), or show THINKING.
  let s1 = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    const guess = provisionalFrom(s, scan.elements);
    s.predicted = null; // a prediction is only good for the turn right after it
    if (guess) {
      s.status = "awaiting_action";
      s.currentStep = guess.step;
      s.currentElementLabel = guess.element.label;
      s.stepUrl = scan.page.url;
    } else {
      s.status = "thinking";
    }
  });
  if (!s1) return;
  let provisional = s1.status === "awaiting_action" ? s1.currentStep : null;
  if (provisional) {
    log(`t${turn} predicted_hit #${provisional.elementId} "${s1.currentElementLabel}"`);
    const reply = await sendToTab(tabId, { type: "POINTR_STEP", turn, step: provisional, provisional: true });
    if (!isLive()) return;
    if (reply && reply.ok === false) {
      // Not showable after all: fall back to the normal "thinking" path.
      provisional = null;
      s1 = await updateSession(tabId, (s) => {
        if (!isLive() || s.turn !== turn || s.status !== "awaiting_action") return false;
        s.status = "thinking";
        s.currentStep = null;
        s.currentElementLabel = null;
        s.stepUrl = null;
      });
      if (!s1) return;
      await sendToTab(tabId, { type: "POINTR_THINKING", turn, goal: s1.goal });
    }
  } else {
    await sendToTab(tabId, { type: "POINTR_THINKING", turn, goal: s1.goal });
  }
  if (!isLive()) return;

  const timings = { scanMs, captureMs: shot.captureMs, marksMs: shot.marksMs };
  if (settleMs !== undefined) timings.settleMs = settleMs;

  const response = await requestNextStep({
    sessionId: s1.sessionId,
    turn,
    goal: s1.goal,
    page: scan.page,
    elements: scan.elements,
    history: s1.history.slice(-HISTORY_SENT),
    screenshot: shot.screenshot,
    timings,
  });
  // The user may already have acted on the predicted step (this run is then
  // stale), but whether the model agreed is still the prediction's accuracy.
  if (provisional && response.ok) {
    const agrees = provisional.elementId === response.step.elementId && provisional.action === response.step.action;
    const late = !isLive() || (await getSession(tabId))?.turn !== turn;
    log(`t${turn} ${agrees ? "predicted_confirmed" : "predicted_replaced"} (model: ${response.step.action} #${response.step.elementId ?? "-"})${late ? ", user already acted: answer discarded" : ""}`);
  }
  if (!isLive()) return;

  if (!response.ok) {
    await fail(tabId, isLive, turn, response.error, response.retryable);
    return;
  }
  // The user already acted on the provisional step: the turn moved on and
  // this answer is for a screen that no longer exists.
  const now = await getSession(tabId);
  if (!now || now.turn !== turn) return;

  const step = response.step;
  log(`t${turn} ${step.action} #${step.elementId ?? "-"} "${step.instruction}" (${response.provider}, ${response.latencyMs} ms)`);

  // 4a. Goal reached. (A done "show" step still points at the answer first:
  // it ends when the user presses "Got it", see recordOutcome.)
  if (step.done && step.action === "info") {
    const current = await getSession(tabId);
    if (!isLive() || !current || current.turn !== turn) return;
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, { type: "POINTR_DONE", message: step.instruction });
    return;
  }

  // 4b. Show the step and wait for the user. With a provisional step on
  // screen, the same POINTR_STEP either confirms it (same element and action:
  // content only updates the caption) or replaces it.
  const target = scan.elements.find((el) => el.id === step.elementId);
  const s2 = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    if (provisional && s.status !== "awaiting_action") return false; // user already acted
    s.status = "awaiting_action";
    s.currentStep = step;
    s.currentElementLabel = target ? target.label : null;
    s.stepUrl = scan.page.url;
    s.predicted = step.done ? null : step.next || null;
  });
  if (!s2) return;

  const reply = await sendToTab(tabId, { type: "POINTR_STEP", turn, step });
  if (!isLive()) return;
  if (reply && reply.ok === false && reply.reason === "element_missing") {
    // The page changed between the scan and now: re-plan from the new screen.
    log(`t${turn} target #${step.elementId} is gone, recording page_changed`);
    if (await recordOutcome(tabId, turn, "page_changed")) await proceedAfterSettle(tabId);
  }
  // no_content_script: the page is navigating; its POINTR_HELLO takes over.
}

async function fail(tabId, isLive, turn, message, retryable, detail) {
  if (detail) console.error("[Pointr:sw]", message, detail);
  const s = await updateSession(tabId, (s) => {
    if (!isLive() || s.turn !== turn) return false;
    s.status = "error";
  });
  if (!s) return;
  log(`t${turn} error: ${message} (retryable: ${retryable})`);
  await sendToTab(tabId, { type: "POINTR_ERROR", message, retryable: !!retryable });
}

// AWAITING_ACTION -> SETTLING. Returns true if the outcome was recorded
// (false for a stale turn or wrong status). "Got it" on a done "show" step
// ends the session instead (the answer was the goal).
export async function recordOutcome(tabId, turn, outcome) {
  const current = await getSession(tabId);
  const step = current && current.currentStep;
  if (
    step && step.done && step.action === "show" && outcome === "confirmed" &&
    current.status === "awaiting_action" && current.turn === turn
  ) {
    log(`t${turn} -> confirmed the answer, done`);
    cancelRuns(tabId);
    await clearSession(tabId);
    await sendToTab(tabId, { type: "POINTR_DONE", message: step.instruction });
    return false;
  }
  const s = await updateSession(tabId, (s) => {
    if (s.status !== "awaiting_action" || s.turn !== turn || !s.currentStep) return false;
    s.history.push({
      turn,
      action: s.currentStep.action,
      instruction: s.currentStep.instruction,
      elementLabel: s.currentElementLabel,
      outcome,
      url: s.stepUrl || "",
    });
    if (outcome === "clicked_elsewhere") s.offPathStreak += 1;
    else if (outcome === "completed" || outcome === "confirmed" || outcome === "scrolled") s.offPathStreak = 0;
    // page_changed, target_covered: streak unchanged
    s.turn += 1;
    s.status = "settling";
    s.outcomeAt = Date.now();
    s.currentStep = null;
    s.currentElementLabel = null;
    s.stepUrl = null;
  });
  if (s) {
    lastOutcomeAt.set(tabId, Date.now());
    log(`t${turn} -> ${outcome} (off-path streak ${s.offPathStreak})`);
  }
  return !!s;
}

// SETTLING -> CHECKIN (3 off-path clicks in a row) or the next turn.
export async function proceedAfterSettle(tabId) {
  const s = await updateSession(tabId, (s) => {
    if (s.status !== "settling") return false;
    s.status = s.offPathStreak >= OFF_PATH_LIMIT ? "checkin" : "observing";
  });
  if (!s) return;
  if (s.status === "checkin") {
    cancelRuns(tabId);
    log(`t${s.turn} check-in after ${s.offPathStreak} off-path clicks`);
    await sendToTab(tabId, { type: "POINTR_CHECKIN", goal: s.goal });
    return;
  }
  await runTurn(tabId);
}

export async function answerCheckin(tabId, keepGoing) {
  if (!keepGoing) {
    await stopSession(tabId);
    return;
  }
  const s = await updateSession(tabId, (s) => {
    if (s.status !== "checkin") return false;
    s.offPathStreak = 0;
    s.status = "observing";
  });
  if (s) await runTurn(tabId);
}

// POINTR_HELLO: a page finished loading in this tab. Replies (via the returned
// summary) so the widget restores itself, then resumes the loop per section 5.
export async function handleHello(tabId) {
  const s = await getSession(tabId);
  const summary = s ? { goal: s.goal, status: s.status, turn: s.turn } : null;
  const resume = async () => {
    if (!s) return;
    switch (s.status) {
      case "settling":
        await proceedAfterSettle(tabId);
        break;
      case "awaiting_action":
        // User navigated without a watcher event (back button, typed URL, reload).
        if (await recordOutcome(tabId, s.turn, "page_changed")) await proceedAfterSettle(tabId);
        break;
      case "observing":
      case "thinking":
        await runTurn(tabId); // restart the current turn on the new page
        break;
      case "checkin":
        await sendToTab(tabId, { type: "POINTR_CHECKIN", goal: s.goal });
        break;
      case "error":
        await runTurn(tabId); // a reload is a natural "try again"
        break;
    }
  };
  return { summary, resume };
}

// ---- New tabs: a link on the guided page opened a new tab (target=_blank,
// window.open; Outlook's "Sign in" does this). Guidance follows the user
// into it: the session moves to the new tab, the old tab's widget goes idle.
const FOLLOW_WINDOW_MS = 10_000; // a tab opened this soon after the user acted
const lastOutcomeAt = new Map(); // tabId -> Date.now() of the last StepOutcome (memory only)
const movedTo = new Map(); // old tabId -> { tabId, at }

export async function followNewTab(tab) {
  const opener = tab.openerTabId;
  if (opener == null || opener === tab.id) return;
  const url = tab.pendingUrl || tab.url || "";
  const web = /^https?:/i.test(url);
  const blank = url === "" || url === "about:blank"; // window.open() before it navigates
  if (!web && !blank) return; // chrome://newtab (Ctrl+T) and other browser pages
  // Let a STEP_RESULT the old page sent at the same click land first.
  await new Promise((r) => setTimeout(r, 150));
  const s = await getSession(opener);
  if (!s || s.status === "checkin" || s.status === "error" || s.status === "done") return;
  const acting = s.status === "awaiting_action" || s.status === "settling";
  const recent = Date.now() - (lastOutcomeAt.get(opener) || 0) < FOLLOW_WINDOW_MS;
  if (!(acting || (web && recent))) return;
  if (await getSession(tab.id)) return;

  cancelRuns(opener);
  // A turn already running for the old page restarts on the new page's HELLO.
  const status = s.status === "observing" || s.status === "thinking" ? "settling" : s.status;
  await replaceSession({ ...s, tabId: tab.id, status });
  await clearSession(opener);
  movedTo.set(opener, { tabId: tab.id, at: Date.now() });
  log(`t${s.turn} a new tab ${tab.id} opened from tab ${opener}: guidance follows it (${url.slice(0, 80)})`);
  await sendToTab(opener, { type: "POINTR_ENDED" });
}

// The tab a message from `tabId` belongs to now (a late STEP_RESULT from the
// page that opened the new tab still counts, for the new tab's session).
export function currentTabFor(tabId) {
  const m = movedTo.get(tabId);
  if (m && Date.now() - m.at < FOLLOW_WINDOW_MS) return m.tabId;
  return tabId;
}

export async function handleReady(tabId, turn) {
  const s = await getSession(tabId);
  if (!s || s.status !== "settling" || s.turn !== turn) return;
  await proceedAfterSettle(tabId);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (!waitingForActiveTab.has(tabId)) return;
  waitingForActiveTab.delete(tabId);
  log(`tab ${tabId} is visible again, resuming`);
  runTurn(tabId).catch((err) => console.error("[Pointr:sw] runTurn (tab activated) failed", err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  runTokens.delete(tabId);
  waitingForActiveTab.delete(tabId);
  lastOutcomeAt.delete(tabId);
});
