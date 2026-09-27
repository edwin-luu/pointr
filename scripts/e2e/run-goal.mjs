// node run-goal.mjs <startUrl> "<goal>" [popupsJSON] [maxTurns]
import { launch, startGoal, nextUserState, doStep, shot, pointrUi, waitUi, session, hubSetPopups } from "./harness.mjs";
const [startUrl, goal, popupsArg, maxArg] = process.argv.slice(2);
const popups = { bank: 0, pharmacy: 0, grocery: 0, ...(popupsArg ? JSON.parse(popupsArg) : {}) };
await hubSetPopups(popups);
const { ctx, sw, page } = await launch();
const origin = new URL(startUrl).origin;
await page.goto(origin + "/reset"); await page.waitForURL(origin + "/"); await page.waitForTimeout(600);
if (startUrl !== origin + "/") { await page.goto(startUrl); }
await page.waitForTimeout(1200);
const tag = new URL(startUrl).port;
await startGoal(page, goal);
let turn = 0, result = "max turns"; const t0 = Date.now();
for (let i = 0; i < Number(maxArg || 20); i++) {
  let st;
  try { st = await nextUserState(sw, turn, 45000); } catch (e) { result = "stuck: " + e.message.slice(0, 120); break; }
  if (st.kind === "ended") { const ui = await pointrUi(page); result = `ENDED widget=${ui.state} "${ui.text}"`; break; }
  if (st.kind !== "step") { const ui = await pointrUi(page); result = `${st.kind}: ${ui.text}`; break; }
  turn = st.s.turn;
  const prev = st.s.history.slice(-1).map((h) => h.outcome).join("");
  await page.waitForTimeout(250);
  await shot(page, `${tag}-t${turn}`);
  const what = await doStep(page, st.s);
  console.log(`t${turn} [${((Date.now() - t0) / 1000).toFixed(1)}s prev:${prev}] ${st.s.currentStep.action} "${st.s.currentStep.instruction}" -> ${what} | ${page.url().replace(origin, "")}`);
}
await page.waitForTimeout(400);
await shot(page, `${tag}-final`);
console.log("RESULT:", result, `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
await hubSetPopups({ bank: 0.33, pharmacy: 0.4, grocery: 0.2 });
await ctx.close();
