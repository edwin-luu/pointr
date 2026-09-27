// (1) reload mid-flow -> widget restores + page_changed + new step
// (2) 3 off-path clicks -> check-in; Keep going resumes; then 3 more -> Stop ends
import { launch, startGoal, nextUserState, shot, pointrUi, waitUi, clickPointrButton, session, hubSetPopups } from "./harness.mjs";
await hubSetPopups({ bank: 0, pharmacy: 0.4, grocery: 0.2 });
const { ctx, sw, page, pageLogs, swLogs } = await launch();
await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(1200);
await startGoal(page, "pay my credit card bill");
let st = await nextUserState(sw, 0);
console.log(`t${st.s.turn} step shown:`, st.s.currentStep.instruction);

// (1) reload
await page.reload();
const restored = await waitUi(page, (u) => u.state === "thinking" || u.state === "guiding", "restored widget", 8000);
console.log("after reload widget:", restored.state, "|", restored.text);
st = await nextUserState(sw, st.s.turn);
const s = await session(sw);
console.log(`t${st.s.turn} new step:`, st.s.currentStep.instruction, "| history:", s.history.map((h) => `${h.turn}:${h.outcome}`).join(","));
const ui1 = await pointrUi(page);
console.log("widget:", ui1.state, "overlay:", JSON.stringify(ui1.overlay));

// (2) off-path clicks on toast buttons that don't navigate: Locations, Contact us, Espanol (top utility bar)
const offPath = [[180, 14], [262, 14], [340, 14], [180, 14], [262, 14], [340, 14]];
let k = 0;
async function wrongClicks(n) {
  for (let i = 0; i < n; i++) {
    const cur = await nextUserState(sw, 0);
    if (cur.kind !== "step") return cur.kind;
    const [x, y] = offPath[k++];
    await page.mouse.click(x, y);
    console.log(`  t${cur.s.turn} wrong click at ${x},${y}`);
    await new Promise((r) => setTimeout(r, 300));
    // wait until the turn moves on
    await waitUi(page, () => true, "", 1000).catch(() => {});
    const ss = await session(sw);
    if (ss && ss.status === "checkin") return "checkin";
    await nextUserState(sw, cur.s.turn).catch(() => {});
  }
  return (await session(sw)).status;
}
let r = await wrongClicks(3);
const ck = await waitUi(page, (u) => u.state === "checkin", "checkin widget", 15000);
console.log("after 3 wrong clicks:", r, "| widget:", ck.state, "|", ck.text, "| overlay:", JSON.stringify(ck.overlay));
await shot(page, "checkin");
await clickPointrButton(page, "Keep going");
await waitUi(page, (u) => u.state !== "checkin", "left checkin", 5000);
const ckTurn = (await session(sw)).turn;
st = await nextUserState(sw, ckTurn - 1);
console.log("keep going -> new step t" + st.s.turn, st.s.currentStep.instruction, "streak", st.s.offPathStreak);
r = await wrongClicks(3);
await waitUi(page, (u) => u.state === "checkin", "checkin widget 2", 15000);
await clickPointrButton(page, "Stop");
await page.waitForTimeout(800);
const end = await pointrUi(page);
console.log("after Stop:", end.state, "session:", await session(sw), "overlay:", JSON.stringify(end.overlay));
console.log(swLogs.filter((l) => /->|check-in|hello|start/.test(l)).join("\n"));
await hubSetPopups({ bank: 0.33, pharmacy: 0.4, grocery: 0.2 });
await ctx.close();
