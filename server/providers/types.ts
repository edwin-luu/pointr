import type { NextStepRequest, Step } from "../schema.ts";

export type ProviderResult = {
  step: Step;
  inputTokens?: number;
  outputTokens?: number;
};

export type Provider = {
  name: string;
  model: string;
  // `signal` aborts the call (hedged requests abort the loser).
  getNextStep(req: NextStepRequest, extraNote?: string, signal?: AbortSignal): Promise<ProviderResult>;
};

export class ProviderError extends Error {
  retryable: boolean;
  authFailed: boolean;
  constructor(message: string, opts: { retryable?: boolean; authFailed?: boolean } = {}) {
    super(message);
    this.name = "ProviderError";
    this.retryable = opts.retryable ?? false;
    this.authFailed = opts.authFailed ?? false;
  }
}

// Thrown by a provider when the model answered but the text is not a usable
// Step. Each provider retries once on it before giving up.
export class UnparsableOutput extends Error {}

// Calls `once` and retries a single time on UnparsableOutput.
export async function withParseRetry(
  name: string,
  once: () => Promise<ProviderResult>
): Promise<ProviderResult> {
  try {
    return await once();
  } catch (err) {
    if (!(err instanceof UnparsableOutput)) throw err;
    console.warn(`${name}: unparsable output, retrying once (${err.message})`);
    try {
      return await once();
    } catch (err2) {
      if (err2 instanceof UnparsableOutput) {
        throw new ProviderError(`${name} returned unusable output twice: ${err2.message}`, { retryable: true });
      }
      throw err2;
    }
  }
}

// Knobs a provider accepts (for the bake-off). Unknown keys are ignored.
export type ProviderKnobs = Record<string, string>;

// "bedrock:us.amazon.nova-2-lite-v1:0#json=tool,maxTokens=300" ->
// { provider: "bedrock", model: "us.amazon.nova-2-lite-v1:0", knobs: {json:"tool", maxTokens:"300"} }
export function parseProviderSpec(spec: string): { provider: string; model: string; knobs: ProviderKnobs } {
  const [head, knobText = ""] = spec.split("#");
  const colon = head.indexOf(":");
  if (colon < 0) throw new Error(`provider spec must look like provider:model (got "${spec}")`);
  const knobs: ProviderKnobs = {};
  for (const pair of knobText.split(",").filter(Boolean)) {
    const [k, v = "true"] = pair.split("=");
    knobs[k.trim()] = v.trim();
  }
  return { provider: head.slice(0, colon), model: head.slice(colon + 1), knobs };
}
