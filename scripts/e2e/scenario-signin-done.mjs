// Goal "sign in": exercises type/type/click steps and the DONE path.
import { launch, startGoal, nextUserState, doStep, shot, pointrUi, waitUi, hubSetPopups } from "./harness.mjs";
await hubSetPopups({ bank: 0, pharmacy: 0.4, grocery: 0.2 });
const { ctx, sw, page } = await launch();
await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(1200);
await startGoal(page, "sign in to my account");
let turn = 0;
for (let i = 0; i < 8; i++) {
  const st = await nextUserState(sw, turn);
  if (st.kind !== "step") { console.log("STATE", st.kind); break; }
  turn = st.s.turn;
  console.log(`t${turn} ${st.s.currentStep.action} "${st.s.currentStep.instruction}" -> ${await doStep(page, st.s)}`);
}
const ui = await waitUi(page, (u) => u.state === "done", "done state", 20000).catch((e) => ({ err: e.message }));
console.log("DONE UI:", JSON.stringify(ui && { state: ui.state, text: ui.text, overlay: ui.overlay }));
await shot(page, "signin-done");
await page.waitForTimeout(3300);
const after = await pointrUi(page);
console.log("after 3.3s:", after.state);
await hubSetPopups({ bank: 0.33, pharmacy: 0.4, grocery: 0.2 });
await ctx.close();
