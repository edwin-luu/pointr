// Summarizes server/logs/timings.csv: p50/p90 per stage, per provider:model.
// Only rows that came from the extension (they have scan/capture/marks) count,
// so fixture replays and bake-offs do not skew the numbers.
// Usage: node scripts/timings.ts [--since <ISO date>] [--model <substring>]
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const since = flag("--since");
const modelFilter = flag("--model");

const csv = await readFile(path.join(import.meta.dirname, "../logs/timings.csv"), "utf8");
const [headerLine, ...lines] = csv.trim().split("\n");
const header = headerLine.split(",");
const rows = lines
  .map((l) => Object.fromEntries(l.split(",").map((v, i) => [header[i], v])))
  .filter((r) => r.scanMs !== "" && (!since || r.ts >= since) && (!modelFilter || r.model.includes(modelFilter)));

function pct(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const STAGES = ["settleMs", "scanMs", "captureMs", "marksMs", "modelMs"] as const;
const groups = new Map<string, Record<string, string>[]>();
for (const r of rows) {
  const k = `${r.provider}:${r.model}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k)!.push(r);
}

console.log(`| provider:model | turns | ${STAGES.map((s) => `${s.replace("Ms", "")} p50/p90`).join(" | ")} | turn p50/p90 | retries |`);
console.log(`|---|---|${STAGES.map(() => "---").join("|")}|---|---|`);
for (const [k, rs] of groups) {
  const cols = STAGES.map((s) => {
    const v = rs.filter((r) => r[s] !== "").map((r) => Number(r[s]));
    return `${pct(v, 50)} / ${pct(v, 90)}`;
  });
  // Per-turn wall time the user waits after acting: settle + scan + capture + marks + model.
  const total = rs.map((r) => STAGES.reduce((sum, s) => sum + (Number(r[s]) || 0), 0));
  const retries = rs.filter((r) => r.attempt !== "1").length;
  console.log(`| ${k} | ${rs.length} | ${cols.join(" | ")} | ${pct(total, 50)} / ${pct(total, 90)} | ${retries} |`);
}
