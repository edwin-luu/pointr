// Bake-off: replays every fixture against each candidate provider:model N
// times through the same decision logic as the server (validation retry,
// done-resolution retry), and prints accuracy + latency tables.
// Usage: node --env-file=.env scripts/bakeoff.ts [--models a,b] [--runs 3]
//          [--fixtures substr,substr] [--width 1024] [--concurrency 4] [--label text]
// A model spec is provider:model[#knob=value,...], e.g.
//   bedrock:us.amazon.nova-2-lite-v1:0#json=tool
//   gemini:gemini-3-flash-preview#thinking=minimal,media=low
// Saves the tables to server/logs/bakeoff-<ts>.md (+ .json with every answer).
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { makeProvider, type ProviderAnswer } from "../providers/index.ts";
import { decideStep } from "../decide.ts";
import type { NextStepRequest, Step, ElementInfo } from "../schema.ts";

const DEFAULT_MODELS = [
  "bedrock:us.amazon.nova-2-lite-v1:0",
  "bedrock:us.amazon.nova-lite-v1:0",
  "bedrock:us.amazon.nova-pro-v1:0",
  "gemini:gemini-3-flash-preview",
  "gemini:gemini-2.5-flash",
];

const argv = process.argv.slice(2);
const flag = (name: string, def?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const models = (flag("models") || DEFAULT_MODELS.join(",")).split(/,(?=(?:bedrock|gemini):)/);
const runs = Number(flag("runs", "3"));
const fixtureFilter = flag("fixtures")?.split(",");
const width = flag("width") ? Number(flag("width")) : null;
const concurrency = Number(flag("concurrency", "4"));
const label = flag("label", "");

type Expected = {
  acceptableIds: number[];
  action: Step["action"];
  done?: boolean;
  scrollDirection?: "up" | "down";
  // Other answers that are just as good (e.g. click the header "Sign in" link
  // instead of typing in the sign-in card).
  alsoOk?: Array<{ action: Step["action"]; acceptableIds: number[] }>;
  note: string;
};
type Fixture = { name: string; req: NextStepRequest; expected: Expected };

const serverDir = path.resolve(import.meta.dirname, "..");
const fixturesDir = path.join(serverDir, "fixtures");

async function loadFixtures(): Promise<Fixture[]> {
  const out: Fixture[] = [];
  for (const name of (await readdir(fixturesDir)).sort()) {
    if (fixtureFilter && !fixtureFilter.some((f) => name.includes(f))) continue;
    const dir = path.join(fixturesDir, name);
    let expected: Expected;
    try {
      expected = JSON.parse(await readFile(path.join(dir, "expected.json"), "utf8"));
    } catch {
      continue; // no expected.json: not a bake-off fixture
    }
    const req = JSON.parse(await readFile(path.join(dir, "request.json"), "utf8"));
    let jpeg: Buffer = await readFile(path.join(dir, "screenshot.jpg"));
    if (width) jpeg = await resizeJpeg(jpeg, width);
    req.screenshot = jpeg.toString("base64");
    out.push({ name, req, expected });
  }
  return out;
}

// Bilinear downscale (only ever shrinks). jpeg-js is a dev-only dependency.
async function resizeJpeg(buf: Buffer, targetW: number): Promise<Buffer> {
  const jpeg = (await import("jpeg-js")).default;
  const src = jpeg.decode(buf, { useTArray: true });
  if (src.width <= targetW) return buf;
  const w = targetW;
  const h = Math.round((src.height * targetW) / src.width);
  const out = Buffer.alloc(w * h * 4);
  const sx = src.width / w;
  const sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) * sy - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) * sx - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = fx - x0;
      for (let c = 0; c < 4; c++) {
        const p = (yy: number, xx: number) => src.data[(yy * src.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - wx) + p(y0, x1) * wx;
        const bot = p(y1, x0) * (1 - wx) + p(y1, x1) * wx;
        out[(y * w + x) * 4 + c] = Math.round(top * (1 - wy) + bot * wy);
      }
    }
  }
  return Buffer.from(jpeg.encode({ data: out, width: w, height: h }, 80).data);
}

function isCorrect(step: Step, exp: Expected, elements: ElementInfo[]): boolean {
  if (matches(step, exp, elements)) return true;
  return (exp.alsoOk || []).some((alt) => matches(step, { ...exp, ...alt }, elements));
}

function matches(step: Step, exp: Expected, elements: ElementInfo[]): boolean {
  if (step.done !== !!exp.done) return false;
  let actionOk = step.action === exp.action;
  // A native <select> is completed by a click or a "type" alike.
  if (!actionOk && (step.action === "click" || step.action === "type") && (exp.action === "click" || exp.action === "type")) {
    const el = elements.find((e) => e.id === step.elementId);
    actionOk = !!el && el.role === "combobox";
  }
  if (!actionOk) return false;
  if (exp.acceptableIds.length > 0 && !exp.acceptableIds.includes(step.elementId ?? -1)) return false;
  if (exp.scrollDirection && step.scrollDirection !== exp.scrollDirection) return false;
  return true;
}

type Result = {
  fixture: string;
  model: string;
  run: number;
  ok: boolean;
  ms: number;
  calls: number;
  error?: string;
  step?: Step;
  outputTokens?: number;
};

function pct(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function runOne(fx: Fixture, spec: string, run: number): Promise<Result> {
  const provider = providers.get(spec)!;
  let calls = 0;
  let outputTokens = 0;
  const t0 = Date.now();
  try {
    const decision = await decideStep(fx.req, async (note): Promise<ProviderAnswer> => {
      calls++;
      const r = await provider.getNextStep(fx.req, note);
      outputTokens += r.outputTokens ?? 0;
      return { step: r.step, provider: provider.name, model: provider.model, fallback: null, hedge: { hedged: false, winner: 1 } };
    });
    const ms = Date.now() - t0;
    return { fixture: fx.name, model: spec, run, ok: isCorrect(decision.step, fx.expected, fx.req.elements), ms, calls, step: decision.step, outputTokens };
  } catch (err) {
    return { fixture: fx.name, model: spec, run, ok: false, ms: Date.now() - t0, calls, error: (err as Error).message.slice(0, 160) };
  }
}

const fixtures = await loadFixtures();
if (fixtures.length === 0) throw new Error("no fixtures with expected.json matched");
const providers = new Map(models.map((m) => [m, makeProvider(m)]));

// Interleave jobs so a slow minute on one provider does not hit one fixture only.
const jobs: Array<() => Promise<Result>> = [];
for (let run = 1; run <= runs; run++) {
  for (const fx of fixtures) for (const m of models) jobs.push(() => runOne(fx, m, run));
}
const results: Result[] = [];
let next = 0;
let doneCount = 0;
const started = Date.now();
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) {
      const r = await jobs[next++]();
      results.push(r);
      doneCount++;
      if (!r.ok) {
        const got = r.error ? `ERROR ${r.error}` : `${r.step!.action} #${r.step!.elementId ?? "-"}${r.step!.done ? " done" : ""} "${r.step!.instruction}"`;
        process.stderr.write(`  [${doneCount}/${jobs.length}] WRONG ${r.fixture} ${r.model}: ${got}\n`);
      } else if (doneCount % 20 === 0) {
        process.stderr.write(`  [${doneCount}/${jobs.length}] ...\n`);
      }
    }
  })
);

// ---- tables
const lines: string[] = [];
const ts = new Date().toISOString();
lines.push(`# Bake-off ${ts}${label ? ` - ${label}` : ""}`, "");
lines.push(`${fixtures.length} fixtures x ${models.length} models x ${runs} runs${width ? `, screenshots resized to ${width} px` : ""}, concurrency ${concurrency}, ${Math.round((Date.now() - started) / 1000)} s.`, "");
lines.push("| model | accuracy | done-acc | p50 ms | p90 ms | max ms | errors | 2nd calls | out tok | next filled |");
lines.push("|---|---|---|---|---|---|---|---|---|---|");
const doneFixtures = new Set(fixtures.filter((f) => f.expected.done).map((f) => f.name));
for (const m of models) {
  const rs = results.filter((r) => r.model === m);
  const ok = rs.filter((r) => r.ok).length;
  const dr = rs.filter((r) => doneFixtures.has(r.fixture));
  const dOk = dr.filter((r) => r.ok).length;
  const ms = rs.filter((r) => !r.error).map((r) => r.ms);
  const errors = rs.filter((r) => r.error).length;
  const second = rs.filter((r) => r.calls > 1).length;
  const tok = rs.filter((r) => r.outputTokens).map((r) => r.outputTokens!);
  const answered = rs.filter((r) => r.step);
  const withNext = answered.filter((r) => r.step!.next).length;
  lines.push(
    `| ${m} | ${ok}/${rs.length} (${Math.round((100 * ok) / rs.length)}%) | ${dr.length ? `${dOk}/${dr.length}` : "-"} | ${pct(ms, 50)} | ${pct(ms, 90)} | ${Math.max(...ms)} | ${errors} | ${second} | ${tok.length ? Math.round(tok.reduce((a, b) => a + b, 0) / tok.length) : "-"} | ${answered.length ? Math.round((100 * withNext) / answered.length) : 0}% |`
  );
}
lines.push("", "Per fixture (correct/runs):", "");
lines.push(`| fixture | expected | ${models.map((m, i) => `m${i + 1}`).join(" | ")} |`);
lines.push(`|---|---|${models.map(() => "---").join("|")}|`);
for (const fx of fixtures) {
  const e = fx.expected;
  const exp = `${e.action}${e.acceptableIds.length ? ` ${e.acceptableIds.join("/")}` : ""}${e.done ? " done" : ""}`;
  const cells = models.map((m) => {
    const rs = results.filter((r) => r.fixture === fx.name && r.model === m);
    return `${rs.filter((r) => r.ok).length}/${rs.length}`;
  });
  lines.push(`| ${fx.name} | ${exp} | ${cells.join(" | ")} |`);
}
lines.push("", models.map((m, i) => `m${i + 1} = ${m}`).join("; "), "");
lines.push("Wrong answers:", "");
for (const r of results.filter((r) => !r.ok).sort((a, b) => a.fixture.localeCompare(b.fixture) || a.model.localeCompare(b.model))) {
  const got = r.error ? `ERROR ${r.error}` : `${r.step!.action} #${r.step!.elementId ?? "-"}${r.step!.done ? " done" : ""} "${r.step!.instruction}"`;
  lines.push(`- ${r.fixture} / ${r.model}: ${got}`);
}
const md = lines.join("\n") + "\n";
console.log(md);
const stamp = ts.replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
await mkdir(path.join(serverDir, "logs"), { recursive: true });
await writeFile(path.join(serverDir, "logs", `bakeoff-${stamp}.md`), md);
await writeFile(path.join(serverDir, "logs", `bakeoff-${stamp}.json`), JSON.stringify(results, null, 2));
console.log(`saved logs/bakeoff-${stamp}.md`);
