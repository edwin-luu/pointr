// Robot-tester suite: runs every scenario N times against the real
// extension + demo apps + backend, prints one table and saves it to
// .out/suite-<ts>.md. Hub popup odds are always put back to defaults.
// Usage: node suite.mjs [--runs 2] [--only name,name] [--verbose]
//        node suite.mjs --smoke   (3 HEROs + "what's my checking balance?", 1 run, about 1 minute)
import fs from "node:fs";
import path from "node:path";
import {
  launch, startGoal, follow, session, nextUserState, pointrUi, waitUi, clickPointrButton,
  hubSetPopups, appState, turnLatencies, median, shot, OUT, DEFAULT_POPUPS,
} from "./harness.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const SMOKE = argv.includes("--smoke");
const RUNS = Number(flag("runs", SMOKE ? "1" : "2"));
const ONLY = SMOKE
  ? ["bank-hero", "pharmacy-hero", "grocery-hero", "show-bank-balance"]
  : (flag("only", "") || "").split(",").filter(Boolean);
const VERBOSE = argv.includes("--verbose");
const log = (...a) => console.log(...a);
const vlog = (...a) => VERBOSE && console.log(...a);

const BANK = "http://localhost:3001", PHARM = "http://localhost:3002", GROC = "http://localhost:3003";
const NO_POPUPS = { bank: 0, pharmacy: 0, grocery: 0 };

async function resetApp(page, origin) {
  await page.goto(origin + "/reset");
  await page.waitForURL(origin + "/");
  await page.waitForTimeout(800);
}

async function bankLogin(page) {
  await page.goto(BANK + "/login"); await page.waitForTimeout(600);
  await page.getByLabel("Username").fill("eluu");
  await page.getByLabel("Password").fill("1234");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.waitForURL(/accounts/);
  await page.waitForTimeout(600);
}

// ---- side-effect checks (exactly one of the thing the goal does)
const bankPayments = async (page) => {
  const s = await appState(page, "harbor:");
  return s ? s.transactions.filter((t) => t.description === "Payment received - thank you").length : -1;
};
const pharmacyNewOrders = async (page) => {
  const s = await appState(page, "sunplaza:");
  return s ? s.orders.length - 2 : -1; // seed has 2 orders
};
const groceryOrders = async (page) => {
  const s = await appState(page, "freshcart:");
  return s ? s.orders.length : -1;
};

function heroCheck(origin, counter, what) {
  return async (page) => {
    // The state lives in the app's origin; the page may have ended elsewhere.
    if (!page.url().startsWith(origin)) await page.goto(origin + "/");
    const n = await counter(page);
    return n === 1 ? null : `${n} ${what} (want 1)`;
  };
}

const HEROES = {
  bank: { origin: BANK, goal: "pay my credit card bill", budget: 12, check: heroCheck(BANK, bankPayments, "card payments") },
  pharmacy: { origin: PHARM, goal: "refill my blood pressure medicine", budget: 14, check: heroCheck(PHARM, pharmacyNewOrders, "refill orders") },
  grocery: { origin: GROC, goal: "order milk, eggs and bread for pickup", budget: 25, check: heroCheck(GROC, groceryOrders, "orders") },
};

// A plain HERO run, optionally with popups forced and hooks on steps.
function heroScenario(app, { popups = NO_POPUPS, extraBudget = 0, onStep, setup } = {}) {
  const h = HEROES[app];
  return async ({ page, sw }) => {
    await hubSetPopups(popups);
    await resetApp(page, h.origin);
    if (setup) await setup(page);
    await startGoal(page, h.goal);
    const r = await follow(page, sw, { maxTurns: h.budget + extraBudget + 2, log: vlog, onStep: onStep && ((s, i) => onStep(s, i, page)) });
    const problems = [];
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    if (r.steps.length > h.budget + extraBudget) problems.push(`${r.steps.length} steps > budget ${h.budget + extraBudget}`);
    const side = await h.check(page);
    if (side) problems.push(side);
    return { ...r, problems };
  };
}

// "Tell me" goals: must end with a show step whose answer text is right, and
// change nothing.
function showScenario(origin, goal, mustContain, budget) {
  return async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, origin);
    await startGoal(page, goal);
    const r = await follow(page, sw, { maxTurns: budget + 2, log: vlog });
    const problems = [];
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    const last = r.steps[r.steps.length - 1];
    if (!last || last.action !== "show") problems.push(`last step is ${last ? last.action : "none"}, not show`);
    for (const m of mustContain) if (!(r.detail || "").includes(m)) problems.push(`answer lacks "${m}"`);
    if (r.steps.length > budget) problems.push(`${r.steps.length} steps > budget ${budget}`);
    return { ...r, problems };
  };
}

// Clicks on the bank's utility bar (toasts, no navigation): off-path clicks.
const WRONG_CLICKS = [[180, 14], [262, 14], [340, 14]];

async function wrongClicks(page, sw, n) {
  for (let i = 0; i < n; i++) {
    const cur = await nextUserState(sw, 0);
    if (cur.kind !== "step") return cur.kind;
    const [x, y] = WRONG_CLICKS[i % WRONG_CLICKS.length];
    await page.mouse.click(x, y);
    vlog(`    t${cur.s.turn} wrong click at ${x},${y}`);
    // Wait until the loop has moved past this step: the next step is shown,
    // or the check-in is up (after the 3rd click).
    const s = await waitFor(async () => {
      const ss = await session(sw);
      return ss && (ss.status === "checkin" || (ss.turn > cur.s.turn && ss.status === "awaiting_action")) ? ss : false;
    });
    if (s.status === "checkin") return "checkin";
  }
  return (await session(sw))?.status;
}

async function waitFor(fn, timeout = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error("timeout");
}

const SCENARIOS = {
  "bank-hero": heroScenario("bank"),
  "pharmacy-hero": heroScenario("pharmacy"),
  "grocery-hero": heroScenario("grocery"),

  "bank-popup": heroScenario("bank", { popups: { ...NO_POPUPS, bank: 1 }, extraBudget: 1 }),
  "pharmacy-popup": heroScenario("pharmacy", { popups: { ...NO_POPUPS, pharmacy: 1 }, extraBudget: 2 }),
  // One promo per search results page (3 searches).
  "grocery-popup": heroScenario("grocery", { popups: { ...NO_POPUPS, grocery: 1 }, extraBudget: 4 }),

  // User logs out right after the first step on /pay-card.
  "logout-mid-task": async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, BANK);
    await bankLogin(page);
    await page.getByRole("link", { name: "Pay card" }).first().click();
    await page.waitForTimeout(800);
    await startGoal(page, HEROES.bank.goal);
    let loggedOut = false;
    const r = await follow(page, sw, {
      maxTurns: 16, log: vlog,
      onStep: async () => {
        if (loggedOut) return;
        loggedOut = true;
        vlog("    user clicks Log out instead");
        await page.getByRole("button", { name: "Log out" }).click();
        return "skip";
      },
    });
    const problems = [];
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    if (r.steps.length > 12) problems.push(`${r.steps.length} steps > 12`);
    const side = await HEROES.bank.check(page);
    if (side) problems.push(side);
    return { ...r, problems };
  },

  // 3 off-path clicks -> check-in -> Keep going -> finishes the HERO.
  "checkin-keep-going": async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, BANK);
    await startGoal(page, HEROES.bank.goal);
    const problems = [];
    const r1 = await wrongClicks(page, sw, 3);
    if (r1 !== "checkin") problems.push(`no check-in after 3 wrong clicks (${r1})`);
    await waitUi(page, (u) => u.state === "checkin", "checkin widget", 15000);
    await clickPointrButton(page, "Keep going");
    const s = await waitFor(async () => { const ss = await session(sw); return ss && ss.status !== "checkin" ? ss : false; });
    const r = await follow(page, sw, { afterTurn: s.turn - 1, maxTurns: 14, log: vlog });
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    const side = await HEROES.bank.check(page);
    if (side) problems.push(side);
    return { ...r, problems };
  },

  // 3 off-path clicks -> check-in -> Stop -> session gone, widget idle, overlay clear.
  "checkin-stop": async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, BANK);
    await startGoal(page, HEROES.bank.goal);
    const t0 = Date.now();
    const problems = [];
    const r1 = await wrongClicks(page, sw, 3);
    if (r1 !== "checkin") problems.push(`no check-in after 3 wrong clicks (${r1})`);
    const sid = (await session(sw))?.sessionId;
    await waitUi(page, (u) => u.state === "checkin", "checkin widget", 15000);
    await clickPointrButton(page, "Stop");
    await page.waitForTimeout(800);
    const ui = await pointrUi(page);
    if (await session(sw)) problems.push("session still exists after Stop");
    if (ui.state !== "idle(hidden)" && ui.state !== "idle") problems.push(`widget ${ui.state} after Stop`);
    if (ui.overlay.box || ui.overlay.caption || ui.overlay.card) problems.push("overlay left on screen");
    return { end: problems.length ? "fail" : "stopped", steps: [], sessionId: sid, ms: Date.now() - t0, problems };
  },

  // Reload the page while a step is shown (turn 2), then finish.
  "reload-mid-flow": (() => {
    let reloaded = false;
    return heroScenario("bank", {
      setup: async () => { reloaded = false; },
      onStep: async (s, i, page) => {
        if (i !== 1 || reloaded) return;
        reloaded = true;
        vlog("    user reloads the page");
        await page.reload();
        return "skip";
      },
    });
  })(),

  // Browser Back once the user is on /pay-card, then finish.
  "browser-back": (() => {
    let wentBack = false;
    return heroScenario("bank", {
      extraBudget: 2,
      setup: async () => { wentBack = false; },
      onStep: async (s, i, page) => {
        if (wentBack || !page.url().includes("/pay-card")) return;
        wentBack = true;
        vlog("    user presses Back");
        await page.goBack();
        return "skip";
      },
    });
  })(),

  // Grocery promo covers the "+" the user was pointed at.
  "grocery-promo-covers": async ({ page, sw }) => {
    await hubSetPopups({ ...NO_POPUPS, grocery: 1 });
    await resetApp(page, GROC);
    await page.goto(GROC + "/search?q=milk");
    await page.waitForTimeout(500);
    await startGoal(page, "add whole milk to my cart");
    const first = await nextUserState(sw, 0);
    const problems = [];
    // Do nothing: the promo appears ~3 s after the results render.
    const next = await nextUserState(sw, first.s.turn, 20000).catch(() => null);
    const outcome = next && next.s && next.s.history.slice(-1)[0]?.outcome;
    if (outcome !== "target_covered") problems.push(`first outcome ${outcome}, want target_covered`);
    const r = await follow(page, sw, { afterTurn: first.s.turn, maxTurns: 6, log: vlog });
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    const st = await appState(page, "freshcart:");
    const milk = st?.cart?.find((l) => l.productId === "dairy-whole-milk");
    if (!milk) problems.push(`whole milk not in cart: ${JSON.stringify(st?.cart)}`);
    return { ...r, sessionId: r.sessionId || first.s.sessionId, problems };
  },

  // Demo script: one deliberate wrong click (open the site menu) on the 3rd
  // step of the grocery HERO; Pointr must recover and finish.
  "grocery-wrong-click": (() => {
    let done = false;
    return heroScenario("grocery", {
      extraBudget: 3,
      setup: async () => { done = false; },
      onStep: async (s, i, page) => {
        if (done || i !== 2) return;
        done = true;
        vlog("    user opens the site menu instead");
        await page.getByRole("button", { name: /menu/i }).first().click();
        return "skip";
      },
    });
  })(),

  // A link opens the next page in a NEW tab (like Outlook's "Sign in"):
  // guidance must follow the user there and the old tab's widget go idle.
  "new-tab": async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, BANK);
    await startGoal(page, HEROES.bank.goal);
    const first = await nextUserState(sw, 0);
    const problems = [];
    // The user follows a link that opens the sign-in page in a new tab.
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "/login"; a.target = "_blank"; a.textContent = "Sign in (new tab)";
      Object.assign(a.style, { position: "fixed", left: "20px", top: "120px", zIndex: 99999, background: "#fff", padding: "8px" });
      document.body.appendChild(a);
    });
    const [tab2] = await Promise.all([
      page.context().waitForEvent("page"),
      page.mouse.click(40, 132),
    ]);
    await tab2.waitForLoadState();
    await tab2.bringToFront();
    const r = await follow(tab2, sw, { afterTurn: first.s.turn, maxTurns: 14, log: vlog });
    if (r.end !== "done") problems.push(`${r.end} ${r.detail || ""}`.trim());
    const old = await pointrUi(page);
    if (old && old.state !== "idle(hidden)" && old.state !== "idle") problems.push(`old tab widget ${old.state}`);
    const side = await HEROES.bank.check(tab2);
    if (side) problems.push(side);
    return { ...r, sessionId: r.sessionId || first.s.sessionId, problems };
  },

  // Closing the tab mid-task removes its session.
  "tab-close": async ({ page, sw }) => {
    await hubSetPopups(NO_POPUPS);
    await resetApp(page, BANK);
    await startGoal(page, HEROES.bank.goal);
    const t0 = Date.now();
    const first = await nextUserState(sw, 0);
    const sid = first.s && first.s.sessionId;
    const spare = await page.context().newPage(); // keep the browser open
    await page.close();
    await new Promise((r) => setTimeout(r, 800));
    const left = Object.keys(await sw.evaluate(() => chrome.storage.session.get(null))).filter((k) => k.startsWith("session:"));
    await spare.goto("about:blank");
    const problems = left.length ? [`${left.length} session(s) left after closing the tab`] : [];
    return { end: problems.length ? "fail" : "closed", steps: [], sessionId: sid, ms: Date.now() - t0, problems, page: spare };
  },

  "show-bank-balance": showScenario(BANK, "what's my checking balance?", ["$2,431.18"], 6),
  "show-bank-groceries": showScenario(BANK, "how much did I spend on groceries last month?", ["$412.56"], 10),
  "show-pharmacy-allergies": showScenario(PHARM, "what are my allergies?", ["Penicillin", "Sulfa"], 8),
  "show-pharmacy-a1c": showScenario(PHARM, "what was my last A1C?", ["6.1%"], 10),
};

// ---- run
const names = Object.keys(SCENARIOS).filter((n) => ONLY.length === 0 || ONLY.some((o) => n.includes(o)));
const rows = [];
const started = Date.now();
try {
  for (const name of names) {
    for (let run = 1; run <= RUNS; run++) {
      const { ctx, sw, page, swLogs, pageLogs } = await launch();
      const t0 = Date.now();
      let res;
      try {
        res = await SCENARIOS[name]({ page, sw });
      } catch (err) {
        res = { end: "crash", steps: [], problems: [String(err.message || err).slice(0, 200)] };
      }
      await shot(page, `suite-${name}-r${run}`).catch(() => {});
      const lat = turnLatencies(res.sessionId);
      const hits = swLogs.filter((l) => l.includes("predicted_hit")).length;
      const conf = swLogs.filter((l) => l.includes("predicted_confirmed")).length;
      const row = {
        name, run, pass: res.problems.length === 0, steps: res.steps.length,
        seconds: ((Date.now() - t0) / 1000).toFixed(1), medianTurnMs: median(lat), turnsLogged: lat.length,
        predicted: hits ? `${conf}/${hits}` : "-", problems: res.problems.join("; "),
      };
      rows.push(row);
      log(`${row.pass ? "PASS" : "FAIL"} ${name} r${run}: ${row.steps} steps, ${row.seconds}s, median turn ${row.medianTurnMs} ms${row.problems ? ` | ${row.problems}` : ""}`);
      if (!row.pass) {
        // Keep the extension's own logs of a failed run for debugging.
        const f = path.join(OUT, `fail-${name}-r${run}-${Date.now()}.log`);
        fs.writeFileSync(f, ["== service worker", ...swLogs, "", "== page", ...pageLogs].join("\n"));
        log(`    logs: ${f}`);
      }
      if (!row.pass && VERBOSE) for (const s of res.steps) log(`    t${s.turn} ${s.action} "${s.instruction}" -> ${s.what}`);
      if (VERBOSE) for (const l of swLogs.filter((l) => l.includes("predicted"))) log(`    sw: ${l.replace(/^\d+ /, "")}`);
      await ctx.close();
    }
  }
} finally {
  await hubSetPopups(DEFAULT_POPUPS);
}

const allLat = rows.map((r) => r.medianTurnMs).filter((v) => v != null);
const md = [
  `# Robot-tester suite ${new Date().toISOString()}`,
  "",
  `${rows.filter((r) => r.pass).length}/${rows.length} passed, ${RUNS} run(s) each, ${Math.round((Date.now() - started) / 1000)} s total. Median of per-run median turn latency: ${median(allLat)} ms.`,
  "",
  "| scenario | run | pass | steps | seconds | median turn ms | predicted confirmed/hit | problems |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.name} | ${r.run} | ${r.pass ? "PASS" : "FAIL"} | ${r.steps} | ${r.seconds} | ${r.medianTurnMs ?? "-"} | ${r.predicted} | ${r.problems || ""} |`),
  "",
].join("\n");
const file = path.join(OUT, `suite-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "")}.md`);
fs.writeFileSync(file, md);
console.log("\n" + md + `\nsaved ${file}`);
