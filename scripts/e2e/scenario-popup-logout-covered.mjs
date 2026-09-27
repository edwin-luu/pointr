import { launch, startGoal, nextUserState, doStep, shot, pointrUi, session, hubSetPopups } from "./harness.mjs";
const which = process.argv[2];
const { ctx, sw, page, swLogs } = await launch();
async function follow(n, label, stopWhen) {
  let turn = (await session(sw))?.turn - 1 || 0;
  for (let i = 0; i < n; i++) {
    const st = await nextUserState(sw, turn);
    if (st.kind !== "step") { console.log(`  ${label} STATE`, st.kind); return st; }
    turn = st.s.turn;
    const hist = st.s.history.slice(-1).map((h) => h.outcome).join("");
    await page.waitForTimeout(300);
    await shot(page, `${label}-t${turn}`);
    if (stopWhen && stopWhen(st.s)) { console.log(`  t${turn} [prev:${hist}] ${st.s.currentStep.action} "${st.s.currentStep.instruction}" (stopping here)`); return st; }
    console.log(`  t${turn} [prev:${hist}] ${st.s.currentStep.action} "${st.s.currentStep.instruction}" -> ${await doStep(page, st.s)} | ${page.url()}`);
  }
}
async function login() {
  await page.goto("http://localhost:3001/login"); await page.waitForTimeout(800);
  await page.fill("#username, input[name=username], input[autocomplete=username]", "eluu").catch(async () => { await page.getByLabel("Username").fill("eluu"); });
  await page.getByLabel("Password").fill("1234");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.waitForURL(/accounts/);
}

if (which === "popup") {
  await hubSetPopups({ bank: 1, pharmacy: 0.4, grocery: 0.2 });
  await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(1200);
  await startGoal(page, "pay my credit card bill");
  await follow(6, "popup", (s) => /paperless|popup|close|later|dialog/i.test(s.currentStep.instruction) && false);
}

if (which === "logout") {
  await hubSetPopups({ bank: 0, pharmacy: 0.4, grocery: 0.2 });
  await page.goto("http://localhost:3001/reset"); await page.waitForURL("http://localhost:3001/"); await page.waitForTimeout(800);
  await login();
  await page.getByRole("link", { name: "Pay card" }).or(page.getByRole("button", { name: "Pay card" })).first().click();
  await page.waitForTimeout(1000);
  console.log("start on", page.url());
  await startGoal(page, "pay my credit card bill");
  const st = await nextUserState(sw, 0);
  console.log(`  t${st.s.turn} ${st.s.currentStep.action} "${st.s.currentStep.instruction}" -> user clicks Log out instead`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForTimeout(500);
  console.log("  now on", page.url());
  await follow(9, "logout");
}

if (which === "covered") {
  await hubSetPopups({ bank: 0.33, pharmacy: 0.4, grocery: 1 });
  await page.goto("http://localhost:3003/reset"); await page.waitForURL("http://localhost:3003/"); await page.waitForTimeout(800);
  await page.goto("http://localhost:3003/search?q=milk"); 
  await page.waitForTimeout(600);
  await startGoal(page, "add whole milk to my cart");
  const st = await nextUserState(sw, 0);
  console.log(`  t${st.s.turn} ${st.s.currentStep.action} "${st.s.currentStep.instruction}" (user waits, promo appears)`);
  const st2 = await nextUserState(sw, st.s.turn, 20000);
  console.log(`  prev outcome: ${st2.s.history.slice(-1)[0].outcome}`);
  await follow(3, "covered");
}
console.log(swLogs.filter((l) => /->|check-in|hello|error/.test(l)).map((l) => l.slice(14)).join("\n"));
await hubSetPopups({ bank: 0.33, pharmacy: 0.4, grocery: 0.2 });
await ctx.close();
