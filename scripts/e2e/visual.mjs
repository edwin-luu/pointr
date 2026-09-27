// Visual self-check: renders every Pointr overlay/widget state on
// each demo app and saves screenshots to .out/visual/<zoom>/<app>-<state>.png.
// States are driven by sending the real SW -> content messages from the
// service worker, so no model call is needed and every state is reachable.
// Usage: node visual.mjs [--zoom 1.25] [--only bank,grocery] [--states open,click]
import fs from "node:fs";
import path from "node:path";
import { launch, hubSetPopups, OUT, DEFAULT_POPUPS } from "./harness.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const ZOOM = Number(flag("zoom", "1"));
const ONLY = (flag("only", "") || "").split(",").filter(Boolean);
const STATES = (flag("states", "") || "").split(",").filter(Boolean);
const dir = path.join(OUT, "visual", `z${ZOOM}`);
fs.mkdirSync(dir, { recursive: true });

// Each app: a page to open (logged-in where it matters) and how to pick targets.
const APPS = {
  bank: { url: "http://localhost:3001/", login: { at: "http://localhost:3001/login", after: /accounts/ },
    click: (e) => e.role === "link" && /pay card/i.test(e.label), type: null,
    show: (e) => e.role === "text" && /\$/.test(e.label) },
  bankLogin: { url: "http://localhost:3001/login",
    click: (e) => e.role === "button" && /^sign in$/i.test(e.label), type: (e) => e.role === "textbox" },
  pharmacy: { url: "http://localhost:3002/",
    click: (e) => /refill/i.test(e.label) && (e.role === "link" || e.role === "button"), type: (e) => e.role === "textbox",
    show: (e) => e.role === "heading" },
  grocery: { url: "http://localhost:3003/",
    click: (e) => e.role === "button" && /add/i.test(e.label), type: (e) => e.role === "textbox" || e.role === "combobox",
    show: (e) => e.role === "text" && /\$/.test(e.label) },
};

const { ctx, sw, page, pageLogs } = await launch({ zoom: ZOOM });
await hubSetPopups({ bank: 0, pharmacy: 0, grocery: 0 });

async function toTab(msg) {
  return sw.evaluate(async (m) => {
    const [t] = await chrome.tabs.query({ active: true });
    return chrome.tabs.sendMessage(t.id, m);
  }, msg);
}
const snap = async (app, state) => {
  if (STATES.length && !STATES.includes(state)) return;
  const p = path.join(dir, `${app}-${state}.png`);
  await page.screenshot({ path: p });
  console.log("  shot", path.relative(OUT, p));
};
const want = (s) => !STATES.length || STATES.includes(s);
const step = (action, elementId, instruction, extra = {}) =>
  ({ action, elementId, scrollDirection: null, instruction, done: false, confidence: "high", reasoning: "visual check", ...extra });

async function scan() {
  const r = await toTab({ type: "POINTR_PREPARE_CAPTURE", turn: 1 });
  return r.elements;
}

for (const [app, a] of Object.entries(APPS)) {
  if (ONLY.length && !ONLY.includes(app)) continue;
  console.log(app);
  if (a.login) {
    await page.goto(a.login.at); await page.waitForTimeout(700);
    await page.getByLabel("Username").fill("eluu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in" }).last().click();
    await page.waitForURL(a.login.after);
  }
  await page.goto(a.url);
  await page.waitForTimeout(1800);
  await page.mouse.move(5, 5);
  await snap(app, "idle");

  // Launcher -> open goal box
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  await page.mouse.click(vw - 52, vh - 52);
  await page.waitForTimeout(400);
  await page.mouse.move(5, 5);
  await snap(app, "open");
  if (want("open-typed")) { await page.keyboard.type("pay my credit card bill"); await snap(app, "open-typed"); }
  await toTab({ type: "POINTR_VOICE_STATE", state: "recording" }); await page.waitForTimeout(300);
  await snap(app, "voice-recording");
  await toTab({ type: "POINTR_VOICE_STATE", state: "transcribing" }); await page.waitForTimeout(300);
  await snap(app, "voice-transcribing");
  await toTab({ type: "POINTR_VOICE_STATE", state: "error", error: "Voice helper isn't running" }); await page.waitForTimeout(300);
  await snap(app, "voice-error");

  // Session states
  let els = await scan();
  await toTab({ type: "POINTR_THINKING", turn: 1, goal: "pay my credit card bill" }); await page.waitForTimeout(400);
  await snap(app, "thinking");

  const pick = (fn) => fn && els.find(fn);
  const clickEl = pick(a.click) || els.find((e) => e.role === "button" || e.role === "link");
  await toTab({ type: "POINTR_STEP", turn: 1, step: step("click", clickEl.id, `Click "${clickEl.label}" to continue.`) });
  await page.waitForTimeout(150);
  await snap(app, "click-gliding");
  await page.waitForTimeout(1100);
  await snap(app, "click");
  // real mouse near the ring -> ghost fades, pulse stops
  const r = clickEl.rect;
  await page.mouse.move(r.x + r.w / 2 + 20, r.y + r.h + 30, { steps: 4 });
  await page.waitForTimeout(450);
  await snap(app, "click-near");
  await page.mouse.move(5, 5);

  els = await scan();
  const typeEl = pick(a.type);
  if (typeEl) {
    await toTab({ type: "POINTR_STEP", turn: 2, step: step("type", typeEl.id, "Type your username in the white box at the top.") });
    await page.waitForTimeout(1200);
    await snap(app, "type");
    els = await scan();
  }
  const showEl = pick(a.show);
  if (showEl) {
    await toTab({ type: "POINTR_STEP", turn: 3, step: step("show", showEl.id, `Here it is: ${showEl.label}.`, { done: true }) });
    await page.waitForTimeout(900);
    await snap(app, "show");
    els = await scan();
  }
  await toTab({ type: "POINTR_STEP", turn: 4, step: step("info", null, "Check your phone for a text with a 6-digit code, then come back here.") });
  await page.waitForTimeout(500);
  await snap(app, "info");
  els = await scan();
  await toTab({ type: "POINTR_STEP", turn: 5, step: step("scroll", null, "Scroll down to see more of the page.", { scrollDirection: "down" }) });
  await page.waitForTimeout(500);
  await snap(app, "scroll");

  // Completion flash: a real click on the ring's target.
  els = await scan();
  const again = pick(a.click) || els.find((e) => e.role === "button" || e.role === "link");
  await toTab({ type: "POINTR_STEP", turn: 6, step: step("click", again.id, `Click "${again.label}".`) });
  await page.waitForTimeout(1000);
  if (want("complete")) {
    await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), { capture: false, once: true }));
    await page.mouse.click(again.rect.x + again.rect.w / 2, again.rect.y + again.rect.h / 2);
    await page.waitForTimeout(160);
    await snap(app, "complete");
    await page.waitForTimeout(600);
    if (page.url() !== a.url) { await page.goto(a.url); await page.waitForTimeout(1500); }
  }

  await toTab({ type: "POINTR_CHECKIN", goal: "pay my credit card bill" }); await page.waitForTimeout(400);
  await snap(app, "checkin");
  await toTab({ type: "POINTR_ERROR", message: "Pointr's helper server is not running", retryable: true }); await page.waitForTimeout(400);
  await snap(app, "error");
  await toTab({ type: "POINTR_DONE", message: "Your payment of $642.37 is scheduled for today." }); await page.waitForTimeout(700);
  await snap(app, "done");
  await page.waitForTimeout(3200);
}

await hubSetPopups(DEFAULT_POPUPS);
const errs = pageLogs.filter((l) => /PAGEERROR|font not loaded/.test(l));
if (errs.length) console.log("page errors:\n" + errs.join("\n"));
await ctx.close();
