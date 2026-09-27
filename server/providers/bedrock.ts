import { parseStepText, parseStepObject, STEP_JSON_SCHEMA, type NextStepRequest } from "../schema.ts";
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
const TOOL_NAME = "give_next_step";

export const DEFAULT_BEDROCK_MODEL = "us.amazon.nova-2-lite-v1:0";

// Amazon Bedrock Converse API over plain fetch with a Bedrock API key (bearer
// token). Returns null when the key is not set.
// Knobs: json=text|tool (plain-text JSON, or a forced tool call whose input
// schema is the Step), maxTokens (default 300), reasoning=last (field order).
export function createBedrockProvider(model = process.env.BEDROCK_MODEL || DEFAULT_BEDROCK_MODEL, knobs: ProviderKnobs = {}): Provider | null {
  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!apiKey) return null;
  const region = process.env.AWS_REGION || "us-east-1";
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`;
  const useTool = (knobs.json || process.env.BEDROCK_JSON || "text") === "tool";
  const maxTokens = Number(knobs.maxTokens) || 300;
  const systemPrompt = systemPromptFor({ reasoningLast: knobs.reasoning === "last", noNext: knobs.next === "off" });

  const { propertyOrdering: _ignored, ...toolSchema } = STEP_JSON_SCHEMA;

  async function callOnce(req: NextStepRequest, extraNote: string | undefined, signal: AbortSignal | undefined): Promise<ProviderResult> {
    const userText = buildUserText(req) + (extraNote ? `\nNOTE: ${extraNote}` : "");
    const body: Record<string, unknown> = {
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [
            { image: { format: "jpeg", source: { bytes: req.screenshot } } },
            { text: userText },
          ],
        },
      ],
      inferenceConfig: { maxTokens, temperature: 0 },
    };
    if (useTool) {
      body.toolConfig = {
        tools: [
          {
            toolSpec: {
              name: TOOL_NAME,
              description: "Give the user the single next step toward their goal.",
              inputSchema: { json: toolSchema },
            },
          },
        ],
        toolChoice: { tool: { name: TOOL_NAME } },
      };
    }

    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    let json: any;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: combined,
      });
      json = await res.json().catch(() => null);
    } catch (err) {
      if (signal?.aborted) throw new ProviderError("Bedrock request aborted", { retryable: true });
      if (timeout.aborted) {
        throw new ProviderError("Bedrock request timed out after 15s", { retryable: true });
      }
      throw new ProviderError(`Could not reach Bedrock: ${(err as Error).message}`, { retryable: true });
    }

    if (!res.ok) {
      const message: string = (json && (json.message || json.Message)) || `HTTP ${res.status}`;
      const detail = `Bedrock ${res.status}: ${message.slice(0, 200)}`;
      if (
        res.status === 401 ||
        res.status === 403 ||
        /expired|invalid.*(token|key)|security token|bearer|not authorized|authenticat/i.test(message)
      ) {
        throw new ProviderError(detail, { authFailed: true });
      }
      if (res.status === 429 || res.status === 408 || res.status >= 500 || /throttl|too many/i.test(message)) {
        throw new ProviderError(detail, { retryable: true });
      }
      throw new ProviderError(detail);
    }

    const usage = { inputTokens: json?.usage?.inputTokens, outputTokens: json?.usage?.outputTokens };
    const content: any[] = json?.output?.message?.content || [];
    if (useTool) {
      const input = content.find((c) => c.toolUse)?.toolUse?.input;
      if (!input) throw new UnparsableOutput(`no tool call (stopReason ${json?.stopReason})`);
      try {
        return { step: parseStepObject(input), ...usage };
      } catch (err) {
        throw new UnparsableOutput(`${(err as Error).message}: ${JSON.stringify(input).slice(0, 200)}`);
      }
    }
    const text = content.map((c) => c.text || "").join("");
    if (!text) throw new UnparsableOutput(`empty output (stopReason ${json?.stopReason})`);
    try {
      return { step: parseStepText(text), ...usage };
    } catch (err) {
      throw new UnparsableOutput(`${(err as Error).message} (stopReason ${json?.stopReason}): ${text.slice(0, 200)}`);
    }
  }

  return {
    name: "bedrock",
    model,
    getNextStep(req, extraNote, signal) {
      return withParseRetry("bedrock", () => callOnce(req, extraNote, signal));
    },
  };
}

// Short-term Bedrock API keys are "bedrock-api-key-" + base64(presigned URL).
// Reads X-Amz-Date + X-Amz-Expires from it so startup can say when the key
// dies. Returns null for any other key format. Never logs the key itself.
export function bedrockKeyExpiry(): Date | null {
  const key = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!key || !key.startsWith("bedrock-api-key-")) return null;
  try {
    const decoded = Buffer.from(key.slice("bedrock-api-key-".length), "base64").toString("utf8");
    const date = decoded.match(/X-Amz-Date=(\d{8}T\d{6}Z)/)?.[1];
    const expires = decoded.match(/X-Amz-Expires=(\d+)/)?.[1];
    if (!date || !expires) return null;
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`;
    return new Date(Date.parse(iso) + Number(expires) * 1000);
  } catch {
    return null;
  }
}
