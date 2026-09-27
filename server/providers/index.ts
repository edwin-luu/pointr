import { createBedrockProvider, bedrockKeyExpiry } from "./bedrock.ts";
import { createGeminiProvider } from "./gemini.ts";
import { ProviderError, parseProviderSpec, type Provider, type ProviderResult } from "./types.ts";
import type { NextStepRequest, Step } from "../schema.ts";

export { ProviderError } from "./types.ts";

// After an auth failure on the primary, use the fallback for this long before
// giving the primary another try.
const FALLBACK_MS = 5 * 60_000;

// Hedged requests (ARCHITECTURE 12.2): if the provider has not answered after
// this long, fire an identical second call and take the first usable answer.
// Default 1500 = measured p75 of Nova 2 Lite model time (1405 ms), floored.
// 0 turns hedging off.
const HEDGE_AFTER_MS = Number(process.env.HEDGE_AFTER_MS ?? 1500);

// "bedrock:<model>#knobs" or "gemini:<model>#knobs" -> a provider (bake-off).
export function makeProvider(spec: string): Provider {
  const { provider, model, knobs } = parseProviderSpec(spec);
  const p =
    provider === "bedrock" ? createBedrockProvider(model, knobs) :
    provider === "gemini" ? createGeminiProvider(model, knobs) :
    (() => { throw new Error(`unknown provider "${provider}"`); })();
  if (!p) throw new Error(`${provider} key is not set in server/.env`);
  return p;
}

const choice = (process.env.MODEL_PROVIDER || "bedrock").trim().toLowerCase();
if (choice !== "bedrock" && choice !== "gemini") {
  throw new Error(`MODEL_PROVIDER must be "bedrock" or "gemini" (got "${choice}")`);
}

const gemini = createGeminiProvider();
const primaryOrNull = choice === "bedrock" ? createBedrockProvider() : gemini;
if (!primaryOrNull) {
  const keyName = choice === "bedrock" ? "AWS_BEARER_TOKEN_BEDROCK" : "GEMINI_API_KEY";
  throw new Error(`MODEL_PROVIDER=${choice} but ${keyName} is not set in server/.env`);
}
const primary: Provider = primaryOrNull;
const fallback: Provider | null = choice === "bedrock" ? gemini : null;

let fallbackUntil = 0;
let fallbackReason = "";

export type FallbackInfo = { from: string; to: string; reason: string };

// hedged: a second identical call was fired; winner: which call's answer was
// used (1 = the original, 2 = the hedge).
export type HedgeInfo = { hedged: boolean; winner: 1 | 2 };

export type ProviderAnswer = {
  step: Step;
  provider: string;
  model: string;
  fallback: FallbackInfo | null;
  hedge: HedgeInfo;
  outputTokens?: number;
};

// Calls p, and if it is slow, a second identical call in parallel. The first
// call to succeed wins and the other is aborted. If the only running call
// fails with a retryable error before the hedge fired, the hedge fires at
// once (a free retry). Fails when every launched call has failed.
export async function hedgedCall(
  p: Provider,
  req: NextStepRequest,
  extraNote: string | undefined,
  hedgeAfterMs: number
): Promise<{ result: ProviderResult; hedge: HedgeInfo }> {
  const controllers = [new AbortController(), new AbortController()];
  return new Promise((resolve, reject) => {
    let settled = false;
    let launched = 0;
    let failures = 0;
    let firstError: unknown = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      settled = true;
      clearTimeout(timer);
      for (const c of controllers) c.abort();
    };

    const launch = () => {
      const i = launched++;
      p.getNextStep(req, extraNote, controllers[i].signal).then(
        (result) => {
          if (settled) return;
          finish();
          resolve({ result, hedge: { hedged: launched > 1, winner: (i + 1) as 1 | 2 } });
        },
        (err) => {
          if (settled) return;
          failures++;
          firstError ??= err;
          if (failures < launched) return; // the other call is still running
          const retryable = err instanceof ProviderError && err.retryable;
          if (launched < 2 && hedgeAfterMs > 0 && retryable) {
            clearTimeout(timer);
            launch();
            return;
          }
          finish();
          reject(firstError);
        }
      );
    };

    launch();
    if (hedgeAfterMs > 0) {
      timer = setTimeout(() => {
        if (!settled && launched < 2) launch();
      }, hedgeAfterMs);
    }
  });
}

export async function getNextStep(req: NextStepRequest, extraNote?: string): Promise<ProviderAnswer> {
  if (fallback && Date.now() < fallbackUntil) {
    const { result, hedge } = await hedgedCall(fallback, req, extraNote, HEDGE_AFTER_MS);
    return answer(result, fallback, { from: primary.name, to: fallback.name, reason: fallbackReason }, hedge);
  }

  try {
    const { result, hedge } = await hedgedCall(primary, req, extraNote, HEDGE_AFTER_MS);
    if (fallbackUntil !== 0) {
      console.log(`provider: ${primary.name} works again, fallback off`);
      fallbackUntil = 0;
    }
    return answer(result, primary, null, hedge);
  } catch (err) {
    if (!(err instanceof ProviderError && err.authFailed && fallback)) throw err;
    fallbackUntil = Date.now() + FALLBACK_MS;
    fallbackReason = err.message;
    console.warn(
      `\n!!! FALLBACK ${primary.name}->${fallback.name} for 5 min: ${err.message}\n` +
        `!!! Regenerate AWS_BEARER_TOKEN_BEDROCK in server/.env, then restart the server (Ctrl+C, npm run dev).\n`
    );
    const { result, hedge } = await hedgedCall(fallback, req, extraNote, HEDGE_AFTER_MS);
    return answer(result, fallback, { from: primary.name, to: fallback.name, reason: err.message }, hedge);
  }
}

function answer(r: ProviderResult, p: Provider, fb: FallbackInfo | null, hedge: HedgeInfo): ProviderAnswer {
  return { step: r.step, provider: p.name, model: p.model, fallback: fb, hedge, outputTokens: r.outputTokens };
}

// GET /health: provider/model = the configured primary; fallback = the provider
// currently answering instead of it (null while the primary is in use).
export function healthInfo(): { provider: string; model: string; fallback: string | null } {
  return {
    provider: primary.name,
    model: primary.model,
    fallback: fallback && Date.now() < fallbackUntil ? fallback.name : null,
  };
}

export function startupSummary(): string {
  const parts = [`provider ${primary.name} (${primary.model})`];
  parts.push(fallback ? `fallback ${fallback.name} (${fallback.model})` : "no fallback");
  parts.push(HEDGE_AFTER_MS > 0 ? `hedge after ${HEDGE_AFTER_MS} ms` : "no hedging");
  if (primary.name === "bedrock") {
    const expiry = bedrockKeyExpiry();
    if (expiry) {
      const mins = Math.round((expiry.getTime() - Date.now()) / 60_000);
      const when = expiry.toISOString().slice(0, 16).replace("T", " ") + " UTC";
      parts.push(
        mins > 0
          ? `Bedrock key expires ${when} (in ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}m)`
          : `!!! Bedrock key EXPIRED at ${when} - regenerate it`
      );
    }
  }
  return parts.join(" | ");
}
