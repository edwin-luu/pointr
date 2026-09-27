import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextStepRequest, Step } from "./schema.ts";
import type { FallbackInfo, HedgeInfo } from "./providers/index.ts";

const LOG_ROOT = path.join(import.meta.dirname, "logs");
const TIMINGS_CSV = path.join(LOG_ROOT, "timings.csv");
const CSV_HEADER =
  "ts,session,turn,provider,model,settleMs,scanMs,captureMs,marksMs,modelMs,attempt,elements\n";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  );
}

export type TurnLog = {
  req: NextStepRequest;
  step?: Step;
  error?: string;
  provider: string;
  model: string;
  fallback: FallbackInfo | null;
  hedge: HedgeInfo | null;
  modelMs: number;
  totalMs: number;
  attempt: number;
  prompt: string;
};

export async function logTurn(entry: TurnLog): Promise<void> {
  const { req, step, error, provider, model, fallback, hedge, modelMs, totalMs, attempt, prompt } = entry;
  const dirName = `${timestamp()}-${req.sessionId.slice(0, 8)}-t${req.turn}`;
  const dir = path.join(LOG_ROOT, dirName);

  await mkdir(dir, { recursive: true });

  const { screenshot, ...reqWithoutScreenshot } = req;

  await Promise.all([
    writeFile(path.join(dir, "screenshot.jpg"), Buffer.from(screenshot, "base64")),
    writeFile(path.join(dir, "request.json"), JSON.stringify(reqWithoutScreenshot, null, 2)),
    writeFile(
      path.join(dir, "response.json"),
      JSON.stringify(
        {
          step: step ?? null,
          error: error ?? null,
          provider,
          model,
          fallback: fallback ? `FALLBACK ${fallback.from}->${fallback.to}: ${fallback.reason}` : null,
          attempt,
          hedged: hedge?.hedged ?? false,
          winner: hedge?.winner ?? null,
          timings: { ...req.timings, modelMs, totalMs },
          // Kept for older log readers: same as totalMs.
          latencyMs: totalMs,
        },
        null,
        2
      )
    ),
    writeFile(path.join(dir, "prompt.txt"), prompt),
  ]);

  // One CSV line per answered turn (errors live only in response.json, so the
  // CSV stays a clean latency table).
  if (step) await appendTimingsCsv(entry);
}

async function appendTimingsCsv(entry: TurnLog): Promise<void> {
  const t = entry.req.timings;
  const row = [
    new Date().toISOString(),
    entry.req.sessionId,
    entry.req.turn,
    entry.provider,
    entry.model,
    t?.settleMs ?? "",
    t?.scanMs ?? "",
    t?.captureMs ?? "",
    t?.marksMs ?? "",
    entry.modelMs,
    entry.attempt,
    entry.req.elements.length,
  ].join(",");
  const exists = await stat(TIMINGS_CSV).then(() => true, () => false);
  await appendFile(TIMINGS_CSV, (exists ? "" : CSV_HEADER) + row + "\n");
}
