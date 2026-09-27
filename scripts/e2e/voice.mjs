// Voice E2E: the real extension with Chromium's fake microphone
// playing a WAV. Checks the welcome tab's "Allow microphone", Alt+X (sent the
// way the command handler sends it: POINTR_TOGGLE_VOICE to the tab), the mic
// button, Alt+X during guidance, silence, and the whisper-down message.
// Usage: node voice.mjs [--skip-down]
import path from "node:path";
import { execSync } from "node:child_process";
import { launch, pointrUi, waitUi, session, waitStatus, clickPointrButton, hubSetPopups, DEFAULT_POPUPS, OUT } from "./harness.mjs";

const SAMPLES = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../server/voice/samples");
const SKIP_DOWN = process.argv.includes("--skip-down");
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };

async function run(wav, fn) {
  const t = await launch({ fakeMic: path.join(SAMPLES, wav) });
  try { await fn(t); } finally { await t.ctx.close(); }
}
const altX = (sw) => sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(t.id, { type: "POINTR_TOGGLE_VOICE" });
});

await hubSetPopups({ bank: 0, pharmacy: 0, grocery: 0 });

// 1. Welcome tab + Alt+X twice -> text -> guidance starts
await run("goal-bank.wav", async ({ sw, page, welcome, swLogs }) => {
  check("welcome tab opened on install", !!welcome);
  await welcome.bringToFront();
  await welcome.waitForTimeout(500);
  await welcome.screenshot({ path: path.join(OUT, "visual", "welcome-before.png") });
  await allowMic(welcome).then(() => check("welcome: allow -> success text", true), () => check("welcome: allow -> success text", false));
  await welcome.screenshot({ path: path.join(OUT, "visual", "welcome-after.png") });
  await welcome.close();
  await page.bringToFront();

  await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(1200);
  await altX(sw);
  const rec = await waitUi(page, (u) => u.state === "open" && u.buttons.some((b) => b.label === "Stop recording"), "recording", 5000).catch(() => null);
  check("Alt+X opens the box and records", !!rec);
  await page.waitForTimeout(3000); // the clip is ~1.5 s
  const t0 = Date.now();
  await altX(sw);
  const s = await waitFor(async () => { const x = await session(sw); return x && x.goal ? x : false; }, 15000);
  const ms = Date.now() - t0;
  check("second Alt+X -> text -> goal sent", !!s && /credit card/i.test(s.goal), s ? `"${s.goal}" in ${ms} ms (incl. 300 ms show-before-send)` : "");
  // Alt+X during guidance: stops the task and records a new goal.
  await waitStatus(sw, ["awaiting_action"], { timeout: 30000 }).catch(() => null);
  const firstId = (await session(sw))?.sessionId;
  await altX(sw);
  const rec2 = await waitUi(page, (u) => u.state === "open" && u.buttons.some((b) => b.label === "Stop recording"), "recording 2", 5000).catch(() => null);
  const gone = !(await session(sw));
  check("Alt+X during guidance stops the task and records", !!rec2 && gone, `recording=${!!rec2} sessionGone=${gone}`);
  await page.waitForTimeout(2500);
  await altX(sw);
  const s2 = await waitFor(async () => { const x = await session(sw); return x && x.sessionId !== firstId ? x : false; }, 15000);
  check("... and the new goal starts a new task", !!s2, s2 ? `"${s2.goal}"` : "");
  // Stop the task, then an instant double press: a near-empty recording.
  await clickPointrButton(page, "Stop").catch(() => {});
  await page.waitForTimeout(400);
  await altX(sw);
  await page.waitForTimeout(150);
  await altX(sw);
  const silent = await waitUi(page, (u) => /couldn't hear anything/.test(u.text), "silence note", 12000).catch(() => null);
  check("nothing said -> \"I couldn't hear anything\"", !!silent);
  console.log(swLogs.filter((l) => /voice/.test(l)).map((l) => "   sw: " + l.replace(/^\d+ /, "")).join("\n"));
});

// 2. The mic button does the same
await run("goal-grocery.wav", async ({ sw, page, welcome }) => {
  await allowMic(welcome);
  await welcome.close();
  await page.bringToFront();
  await page.goto("http://localhost:3003/reset"); await page.waitForURL("http://localhost:3003/"); await page.waitForTimeout(1200);
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  await page.mouse.click(vw - 52, vh - 52);
  await page.waitForTimeout(400);
  await clickPointrButton(page, "Speak your goal");
  await waitUi(page, (u) => u.buttons.some((b) => b.label === "Stop recording"), "recording", 5000);
  await page.screenshot({ path: path.join(OUT, "visual", "voice-live-recording.png") });
  await page.waitForTimeout(3200);
  await clickPointrButton(page, "Stop recording");
  const s = await waitFor(async () => { const x = await session(sw); return x && x.goal ? x : false; }, 15000);
  check("mic button -> text -> goal sent", !!s && /milk/i.test(s.goal), s ? `"${s.goal}"` : "");
});

// 3. Whisper down -> friendly message
if (!SKIP_DOWN) {
  execSync("docker compose -f ../../server/docker-compose.yml stop whisper", { stdio: "ignore" });
  try {
    await run("goal-bank.wav", async ({ sw, page, welcome }) => {
      await allowMic(welcome);
      await welcome.close();
      await page.bringToFront();
      await page.goto("http://localhost:3001/"); await page.waitForTimeout(1200);
      await altX(sw); await page.waitForTimeout(2500); await altX(sw);
      const bad = await waitUi(page, (u) => /Voice helper isn't running/.test(u.text), "down note", 15000).catch(() => null);
      check("whisper down -> \"Voice helper isn't running\"", !!bad);
    });
  } finally {
    execSync("docker compose -f ../../server/docker-compose.yml start whisper", { stdio: "ignore" });
  }
}

await hubSetPopups(DEFAULT_POPUPS);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} voice checks passed`);
process.exit(results.every((r) => r.ok) ? 0 : 1);

async function waitFor(fn, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); }
  return null;
}

// The fake-UI flag may pre-grant the mic (then the page shows success at once).
async function allowMic(welcome) {
  await welcome.waitForTimeout(400);
  const btn = welcome.getByRole("button", { name: "Allow microphone" });
  if (await btn.isVisible()) await btn.click();
  await welcome.waitForSelector("#ok.on", { timeout: 5000 });
}
