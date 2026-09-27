import http from "node:http";
import { validateRequest, type NextStepRequest, type NextStepResponse } from "./schema.ts";
import { getNextStep, healthInfo, startupSummary, ProviderError, type ProviderAnswer } from "./providers/index.ts";
import { decideStep } from "./decide.ts";
import { buildUserText } from "./prompt.ts";
import { logTurn } from "./logger.ts";
import { handleTranscribe, whisperStatus } from "./transcribe.ts";

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 8 * 1024 * 1024;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(json);
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function timingsText(req: NextStepRequest, modelMs: number): string {
  const t = req.timings;
  if (!t) return `model ${modelMs}ms`;
  const settle = t.settleMs !== undefined ? ` settle ${t.settleMs}` : "";
  return `model ${modelMs}ms | scan ${t.scanMs} capture ${t.captureMs} marks ${t.marksMs}${settle}`;
}

async function handleNextStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let raw: Buffer;
  try {
    raw = await readBody(req);
  } catch {
    sendJson(res, 413, { ok: false, error: "Request body too large (max 8 MB)", retryable: false });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    sendJson(res, 400, { ok: false, error: "Request body is not valid JSON", retryable: false });
    return;
  }

  const validated = validateRequest(parsed);
  if (typeof validated === "string") {
    sendJson(res, 400, { ok: false, error: validated, retryable: false });
    return;
  }
  const nextStepReq: NextStepRequest = validated;

  const start = Date.now();
  let attempt = 0; // model calls made for this turn
  let modelMs = 0;
  const health = healthInfo();
  let answer: ProviderAnswer | null = null;

  async function ask(note?: string): Promise<ProviderAnswer> {
    const t0 = Date.now();
    attempt++;
    try {
      return await getNextStep(nextStepReq, note);
    } finally {
      modelMs += Date.now() - t0;
    }
  }

  try {
    const decision = await decideStep(nextStepReq, async (note) => {
      answer = await ask(note);
      return answer;
    });
    const step = decision.step;
    answer = decision.answer;

    const totalMs = Date.now() - start;
    await logTurn({
      req: nextStepReq,
      step,
      provider: answer.provider,
      model: answer.model,
      fallback: answer.fallback,
      hedge: answer.hedge,
      modelMs,
      totalMs,
      attempt,
      prompt: buildUserText(nextStepReq),
    });

    const hedged = answer.hedge.hedged ? ` [hedged, winner ${answer.hedge.winner}]` : "";
    const via = answer.fallback ? ` [FALLBACK ${answer.fallback.from}->${answer.fallback.to}]` : "";
    console.log(
      `t${nextStepReq.turn} ${step.action} #${step.elementId ?? "-"} "${step.instruction}" ` +
        `${timingsText(nextStepReq, modelMs)}${hedged}${via}`
    );

    const response: NextStepResponse = {
      ok: true,
      step,
      latencyMs: totalMs,
      provider: answer.provider,
      model: answer.model,
    };
    sendJson(res, 200, response);
  } catch (err) {
    const totalMs = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    const retryable = err instanceof ProviderError ? err.retryable : false;
    // The widget shows this text, so auth problems get a plain message; the
    // technical detail stays in the console + response.json.
    const message =
      err instanceof ProviderError && err.authFailed
        ? "Pointr's AI key has expired or is invalid. Renew it in server/.env."
        : detail;

    await logTurn({
      req: nextStepReq,
      error: detail,
      provider: answer?.provider ?? health.provider,
      model: answer?.model ?? health.model,
      fallback: answer?.fallback ?? null,
      hedge: answer?.hedge ?? null,
      modelMs,
      totalMs,
      attempt,
      prompt: buildUserText(nextStepReq),
    });

    console.log(`t${nextStepReq.turn} ERROR "${detail}" ${timingsText(nextStepReq, modelMs)}`);

    const response: NextStepResponse = { ok: false, error: message, retryable };
    sendJson(res, 200, response);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, ...healthInfo() });
    return;
  }

  if (req.method === "POST" && req.url === "/next-step") {
    handleNextStep(req, res).catch((err) => {
      console.error("Unhandled error in /next-step:", err);
      sendJson(res, 500, { ok: false, error: "Internal server error", retryable: false });
    });
    return;
  }

  if (req.method === "POST" && req.url === "/transcribe") {
    handleTranscribe(req, res).catch((err) => {
      console.error("Unhandled error in /transcribe:", err);
      sendJson(res, 500, { ok: false, error: "Internal server error" });
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found", retryable: false });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pointr backend listening on http://0.0.0.0:${PORT} | ${startupSummary()}`);
  whisperStatus().then((line) => console.log(line));
});
