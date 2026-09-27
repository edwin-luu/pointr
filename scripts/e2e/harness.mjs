// E2E harness: loads the real unpacked Pointr extension into Playwright's
// Chromium (new headless mode supports extensions) and drives the demo apps.
// The Pointr UI is in a CLOSED shadow root, so the widget is driven with real
// mouse/keyboard input at its known screen position, like a user would.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const EXT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../extension");
export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const OUT = path.join(HERE, ".out"); // screenshots + throwaway browser profiles (gitignored)
export const LOGS = path.resolve(HERE, "../../server/logs");
export const VW = 1440, VH = 900;

// zoom: emulates Chrome's page zoom (1.25 = 125%: a smaller CSS viewport, drawn bigger).
// fakeMic: a WAV file Chromium plays as the microphone (voice tests).
export async function launch({ headless = true, zoom = 1, fakeMic = null } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(OUT, "profile-"));
  const ctx = await chromium.launchPersistentContext(dir, {
    env: { ...process.env, LD_LIBRARY_PATH: path.join(HERE, ".libs/usr/lib/x86_64-linux-gnu") },
    channel: "chromium",
    headless,
    viewport: { width: Math.round(VW / zoom), height: Math.round(VH / zoom) },
    deviceScaleFactor: zoom,
    args: [
      `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
      ...(fakeMic ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${fakeMic}%noloop`] : []),
    ],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker");
  // A fresh profile is a fresh install: Pointr opens its welcome tab (mic
  // permission). Close it so the test page stays the visible tab.
  const welcome = ctx.pages().find((p) => p.url().includes("welcome.html")) ||
    (await ctx.waitForEvent("page", { predicate: (p) => p.url().includes("welcome.html"), timeout: 3000 }).catch(() => null));
  if (welcome && !fakeMic) await welcome.close();
  const swLogs = [];
  sw.on("console", (m) => swLogs.push(`${Date.now()} ${m.text()}`));
  const page = ctx.pages().find((p) => !p.url().includes("welcome.html")) || (await ctx.newPage());
  await page.bringToFront();
  const pageLogs = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("[Pointr")) pageLogs.push(`${Date.now()} ${t}`);
  });
  page.on("pageerror", (e) => pageLogs.push(`${Date.now()} PAGEERROR ${e.message}`));
  return { ctx, sw, page, swLogs, pageLogs, welcome: fakeMic ? welcome : null };
}

export async function allSessions(sw) {
  return sw.evaluate(() => chrome.storage.session.get(null));
}

export async function session(sw) {
  const all = await allSessions(sw);
  const keys = Object.keys(all).filter((k) => k.startsWith("session:"));
  return keys.length ? all[keys[0]] : null;
}

export async function waitFor(fn, { timeout = 30000, every = 150, label = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, every));
  }
  throw new Error(`timeout waiting for ${label}; last=${JSON.stringify(last)}`);
}

// Wait until the session reaches one of `statuses` (null = session gone).
export async function waitStatus(sw, statuses, opts = {}) {
  return waitFor(async () => {
    const s = await session(sw);
    const st = s ? s.status : null;
    return statuses.includes(st) ? s || { status: null } : false;
  }, { label: `status in ${statuses}`, timeout: 60000, ...opts });
}

// Launcher: 56x56 at right 24 / bottom 24.
export async function clickLauncher(page) {
  await page.mouse.click(VW - 24 - 28, VH - 24 - 28);
}

export async function startGoal(page, goal) {
  await clickLauncher(page);
  await page.waitForTimeout(300);
  await page.keyboard.type(goal);
  await page.keyboard.press("Enter");
}

export function latestLogDirs(n = 1) {
  const dirs = fs.readdirSync(LOGS).filter((d) => /^\d{8}-/.test(d)).sort();
  return dirs.slice(-n).map((d) => path.join(LOGS, d));
}

export async function shot(page, name) {
  const p = path.join(OUT, "shots", `${name}.png`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  return p;
}

export async function hubSetPopups(popups) {
  const res = await fetch("http://localhost:3000/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ popups }),
  });
  return res.json();
}

export function logDirFor(sessionId, turn) {
  const tag = `-${sessionId.slice(0, 8)}-t${turn}`;
  const dirs = fs.readdirSync(LOGS).filter((d) => d.endsWith(tag)).sort();
  return dirs.length ? path.join(LOGS, dirs[dirs.length - 1]) : null;
}

export function stepTarget(sessionId, turn, elementId) {
  const dir = logDirFor(sessionId, turn);
  if (!dir) return null;
  const req = JSON.parse(fs.readFileSync(path.join(dir, "request.json"), "utf8"));
  return { el: req.elements.find((e) => e.id === elementId), req, dir };
}

// What a user would type into a search box for this instruction: the quoted
// word if there is one ("Type 'eggs' in the search box"), else a grocery word
// it mentions, else "milk".
function searchTerm(instruction) {
  const quoted = instruction.match(/["'“‘]([^"'”’]{2,30})["'”’]/);
  if (quoted) return quoted[1];
  const word = instruction.match(/\b(milk|eggs?|bread)\b/i);
  return word ? word[1].toLowerCase() : "milk";
}

export function textFor(label, step) {
  const pick = (l) => {
    l = l.toLowerCase();
    if (l.includes("password")) return "1234";
    if (l.includes("username") || l.includes("user name") || l.includes("user id")) return "eluu";
    if (l.includes("amount")) return "50";
    if (l.includes("search")) return searchTerm(step.instruction);
    if (l.includes("reason")) return "Checkup";
    return null;
  };
  return pick(label) || pick(step.instruction) || "hello";
}

// Waits for the next state that needs the user, returns it.
export async function nextUserState(sw, afterTurn = 0, timeout = 60000) {
  return waitFor(async () => {
    const s = await session(sw);
    if (!s) return { kind: "ended" };
    if (s.status === "awaiting_action" && s.turn > afterTurn && s.currentStep) return { kind: "step", s };
    if (s.status === "checkin") return { kind: "checkin", s };
    if (s.status === "error") return { kind: "error", s };
    return false;
  }, { timeout, label: "user-actionable state" });
}

// Performs the current step like a user would. Returns a description.
export async function doStep(page, s, opts = {}) {
  const step = s.currentStep;
  if (step.action === "scroll") {
    await page.mouse.move(VW / 2, VH / 2);
    await page.mouse.wheel(0, step.scrollDirection === "up" ? -500 : 500);
    return "scrolled";
  }
  if (step.action === "info") {
    // "I did it" button: centered card; find it by screenshot-free heuristic:
    // the card is centered, the button is its last line.
    await clickPointrButton(page, "I did it");
    return "clicked I did it";
  }
  if (step.action === "show") {
    await clickPointrButton(page, "Got it");
    return `clicked Got it on #${step.elementId}`;
  }
  // Act where the ring is, like a user (the ring is the target's rect plus a
  // 7 px pad). This also works for a predicted step shown before the model
  // answered, when no server log exists for the turn yet.
  const ui = await waitFor(async () => { const u = await pointrUi(page); return u && u.ring && u.ring.w > 0 ? u : false; }, { timeout: 5000, label: "ring" }).catch(() => null);
  if (!ui) return `NO RING for #${step.elementId}`;
  // Wait until the ring holds still (Pointr may scroll a half-hidden target
  // into view), like a user waits for the pointer to settle.
  let ring = ui.ring;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(150);
    const u = await pointrUi(page);
    if (!u || !u.ring) break;
    const still = Math.abs(u.ring.cx - ring.cx) < 1 && Math.abs(u.ring.cy - ring.cy) < 1;
    ring = u.ring;
    if (still) break;
  }
  const cx = ring.cx, cy = ring.cy;
  const label = s.currentElementLabel || "";
  const isSelect = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("select"), { x: cx, y: cy });
  if (isSelect) {
    // Pick the option the instruction names ("choose August 2026"), else the
    // first real option, like a user reading the caption would. Set through
    // the native setter + a bubbling change event (works with React).
    const picked = await page.evaluate(({ x, y, instruction, label }) => {
      const sel = document.elementFromPoint(x, y)?.closest("select");
      if (!sel) return null;
      const opts = [...sel.options].filter((o) => o.value && !o.disabled);
      const words = (t) => t.toLowerCase().replace(/[^a-z0-9$.]+/g, " ").split(" ").filter((w) => w.length > 2);
      // The select's own name ("Month") is not a choice.
      const own = new Set(words(label));
      const ins = new Set(words(instruction).filter((w) => !own.has(w)));
      let best = null, bestScore = 0;
      for (const o of opts) {
        const score = words(o.text).filter((w) => ins.has(w)).length;
        if (score > bestScore) { best = o; bestScore = score; }
      }
      const choice = best || opts.find((o) => o.value !== sel.value) || opts[0];
      if (!choice) return null;
      sel.focus();
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, choice.value);
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return choice.text;
    }, { x: cx, y: cy, instruction: step.instruction, label });
    return `pick "${picked}" in #${step.elementId} "${label}"`;
  }
  if (step.action === "click") {
    await page.mouse.click(cx, cy);
    return `click #${step.elementId} "${label}" at ${Math.round(cx)},${Math.round(cy)}`;
  }
  // type
  await page.mouse.click(cx, cy);
  await page.keyboard.press("Control+A");
  const text = opts.text || textFor(label, step);
  await page.keyboard.type(text, { delay: 20 });
  await page.keyboard.press("Tab");
  return `type "${text}" into #${step.elementId} "${label}"`;
}

// ---- Pointr UI inspection through CDP (it can see into the CLOSED shadow root)
export async function pointrUi(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    const find = (n) => {
      if (n.nodeName === "POINTR-ROOT") return n;
      for (const c of n.children || []) { const r = find(c); if (r) return r; }
      return null;
    };
    const host = find(root);
    if (!host || !host.shadowRoots || !host.shadowRoots[0]) return null;
    const sr = host.shadowRoots[0].nodeId;
    const q = async (sel) => (await cdp.send("DOM.querySelectorAll", { nodeId: sr, selector: sel })).nodeIds;
    const html = async (id) => (await cdp.send("DOM.getOuterHTML", { nodeId: id })).outerHTML;
    const box = async (id) => {
      const { model } = await cdp.send("DOM.getBoxModel", { nodeId: id });
      const [x1, y1, , , x3, y3] = model.border;
      return { x: x1, y: y1, w: x3 - x1, h: y3 - y1, cx: (x1 + x3) / 2, cy: (y1 + y3) / 2 };
    };
    const panel = (await q(".pointr-panel"))[0];
    const panelHtml = panel ? await html(panel) : "";
    const state = (panelHtml.match(/data-state="(\w+)"/) || [])[1] || null;
    const hidden = /<div[^>]*class="pointr-panel"[^>]*hidden/.test(panelHtml);
    const text = panelHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const buttons = [];
    for (const id of await q("button")) {
      const h = await html(id);
      // Visible text, else the aria-label (icon buttons like the mic).
      const label = h.replace(/<[^>]+>/g, "").trim() || (h.match(/^<button[^>]*aria-label="([^"]*)"/) || [])[1] || "";
      try { buttons.push({ label, ...(await box(id)) }); } catch { /* not rendered */ }
    }
    // The current step's ring (not a finished one flashing green).
    const boxes = await q(".pointr-box:not(.pointr-complete)");
    const overlay = { box: boxes.length, caption: (await q(".pointr-caption:not(.pointr-leaving)")).length, card: (await q(".pointr-card")).length, arrow: (await q(".pointr-arrow")).length };
    let ring = null;
    // A ring still gliding to a replaced target is not clicked (a user waits for it too).
    if (boxes[0] && !/pointr-gliding/.test(await html(boxes[0]))) { try { ring = await box(boxes[0]); } catch { /* not laid out yet */ } }
    const dock = (await q(".pointr-dock"))[0];
    const dockLeft = dock ? /pointr-left/.test(await html(dock)) : false;
    return { state: hidden ? `${state}(hidden)` : state, text, buttons, overlay, dockLeft, ring };
  } finally {
    await cdp.detach();
  }
}

export async function clickPointrButton(page, label) {
  const ui = await pointrUi(page);
  const b = ui && ui.buttons.find((b) => b.label === label && b.w > 0);
  if (!b) throw new Error(`Pointr button "${label}" not found; have ${ui && ui.buttons.map((b) => b.label)}`);
  await page.mouse.click(b.cx, b.cy);
}

export async function waitUi(page, pred, label, timeout = 30000) {
  return waitFor(async () => { const u = await pointrUi(page); return u && pred(u) ? u : false; }, { timeout, label, every: 250 });
}

// ---- Suite helpers

// Follows Pointr like a user until the session ends, a non-step state shows
// up, or maxTurns steps were done. Returns what happened.
export async function follow(page, sw, { maxTurns = 30, afterTurn = 0, log = () => {}, onStep } = {}) {
  let turn = afterTurn;
  let sessionId = null;
  const steps = [];
  const t0 = Date.now();
  for (let i = 0; i < maxTurns; i++) {
    let st;
    try {
      st = await nextUserState(sw, turn, 45000);
    } catch (e) {
      return { end: "stuck", detail: e.message.slice(0, 160), steps, sessionId, ms: Date.now() - t0 };
    }
    if (st.kind === "ended") {
      const ui = await pointrUi(page);
      return { end: ui && ui.state === "done" ? "done" : `ended(${ui && ui.state})`, detail: ui ? ui.text : "", steps, sessionId, ms: Date.now() - t0 };
    }
    if (st.kind !== "step") {
      return { end: st.kind, detail: (await pointrUi(page))?.text || "", steps, sessionId, ms: Date.now() - t0, session: st.s };
    }
    turn = st.s.turn;
    sessionId = st.s.sessionId;
    if (onStep) {
      const r = await onStep(st.s, steps.length);
      if (r === "stop") return { end: "stopped-by-scenario", steps, sessionId, ms: Date.now() - t0, session: st.s };
      if (r === "skip") continue;
    }
    await page.waitForTimeout(250);
    const what = await doStep(page, st.s);
    const step = st.s.currentStep;
    steps.push({ turn, action: step.action, elementId: step.elementId, instruction: step.instruction, what });
    log(`    t${turn} ${step.action} "${step.instruction}" -> ${what}`);
  }
  return { end: "max-steps", steps, sessionId, ms: Date.now() - t0 };
}

// The app's persisted state (localStorage "<prefix>state"), read in the page.
export async function appState(page, prefix) {
  return page.evaluate((p) => {
    try { return JSON.parse(localStorage.getItem(p + "state")); } catch { return null; }
  }, prefix);
}

// Per-turn wait the user feels after acting, from the server logs of one
// session: settle + scan + capture + marks + server time.
export function turnLatencies(sessionId) {
  if (!sessionId) return [];
  const tag = `-${sessionId.slice(0, 8)}-t`;
  const out = [];
  for (const d of fs.readdirSync(LOGS).filter((d) => d.includes(tag))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(LOGS, d, "response.json"), "utf8"));
      const t = r.timings || {};
      out.push((t.settleMs || 0) + (t.scanMs || 0) + (t.captureMs || 0) + (t.marksMs || 0) + (t.totalMs || 0));
    } catch { /* partial log */ }
  }
  return out;
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export const DEFAULT_POPUPS = { bank: 0.33, pharmacy: 0.4, grocery: 0.2 };
