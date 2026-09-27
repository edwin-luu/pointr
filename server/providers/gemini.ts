import { ApiError, GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import { STEP_JSON_SCHEMA, parseStepText, type NextStepRequest } from "../schema.ts";
import { systemPromptFor, buildUserText } from "../prompt.ts";
import {
  ProviderError,
  UnparsableOutput,
  withParseRetry,
  type Provider,
  type ProviderKnobs,
  type ProviderResult,
} from "./types.ts";

const TIMEOUT_MS = 15_000;

// Fallback model: gemini-3-flash-preview was out of quota / overloaded on
// this key; 3.1 Flash Lite answered 8/10 fixtures at p50 2.5 s.
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const THINKING_LEVELS: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};
const MEDIA_RESOLUTIONS: Record<string, MediaResolution> = {
  low: MediaResolution.MEDIA_RESOLUTION_LOW,
  medium: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
  high: MediaResolution.MEDIA_RESOLUTION_HIGH,
};

// Returns null when GEMINI_API_KEY is not set, so Bedrock-only setups still boot.
// Knobs: thinking=minimal|low|medium|high|off (Gemini 3 takes a level; "off"
// sends no thinkingConfig), budget=<n> (Gemini 2.x thinkingBudget, default 0),
// media=low|medium|high (image token budget), temp=<n>.
export function createGeminiProvider(model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, knobs: ProviderKnobs = {}): Provider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  const isGemini3 = /gemini-3/.test(model);

  const thinkingConfig: Record<string, unknown> | null = (() => {
    if (knobs.budget !== undefined) return { thinkingBudget: Number(knobs.budget) };
    // Gemini 2.x has no levels: its lowest setting is thinkingBudget 0.
    if (!isGemini3) return { thinkingBudget: 0 };
    const level = knobs.thinking || process.env.GEMINI_THINKING || "low";
    if (level === "off") return null;
    return { thinkingLevel: THINKING_LEVELS[level] ?? ThinkingLevel.LOW };
  })();
  const media = MEDIA_RESOLUTIONS[knobs.media || process.env.GEMINI_MEDIA || ""];
  const temperature = knobs.temp !== undefined ? Number(knobs.temp) : undefined;
  const systemPrompt = systemPromptFor({ reasoningLast: knobs.reasoning === "last", noNext: knobs.next === "off" });

  async function callOnce(req: NextStepRequest, extraNote: string | undefined, signal: AbortSignal | undefined): Promise<ProviderResult> {
    const userText = buildUserText(req) + (extraNote ? `\nNOTE: ${extraNote}` : "");
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    const config: Record<string, unknown> = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseJsonSchema: STEP_JSON_SCHEMA,
      abortSignal: combined,
      // No maxOutputTokens: thinking tokens count toward it (truncated JSON).
    };
    if (thinkingConfig) config.thinkingConfig = thinkingConfig;
    if (media) config.mediaResolution = media;
    if (temperature !== undefined) config.temperature = temperature;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: req.screenshot } },
              { text: userText },
            ],
          },
        ],
        config,
      });

      const text = response.text;
      if (!text) throw new ProviderError("Gemini returned an empty response", { retryable: true });
      const usage = {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
      };
      try {
        return { step: parseStepText(text), ...usage };
      } catch (err) {
        throw new UnparsableOutput(`${(err as Error).message}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      if (err instanceof ProviderError || err instanceof UnparsableOutput) throw err;
      if (signal?.aborted) throw new ProviderError("Gemini request aborted", { retryable: true });
      if (timeout.aborted) throw new ProviderError("Gemini request timed out after 15s", { retryable: true });

      // Classify by the HTTP status (ApiError.status). Matching digits in the
      // message text misfired: a 429 quota message contains other numbers.
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
        throw new ProviderError(`Gemini rejected the API key: ${message.slice(0, 200)}`, { authFailed: true });
      }
      if (status === 429) {
        throw new ProviderError(`Gemini rate limit / quota: ${message.slice(0, 160)}`, { retryable: true });
      }
      if (status >= 500) {
        throw new ProviderError(`Gemini unavailable (${status}): ${message.slice(0, 160)}`, { retryable: true });
      }
      throw new ProviderError(`Gemini error${status ? ` ${status}` : ""}: ${message.slice(0, 300)}`);
    }
  }

  return {
    name: "gemini",
    model,
    getNextStep(req, extraNote, signal) {
      return withParseRetry("gemini", () => callOnce(req, extraNote, signal));
    },
  };
}
