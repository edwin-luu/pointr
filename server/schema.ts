export type ElementInfo = {
  id: number;
  role: string;
  label: string;
  inputType?: string;
  hasValue?: boolean;
  focused?: boolean;
  checked?: boolean;
  rect: { x: number; y: number; w: number; h: number };
};

export type PageInfo = {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  scrollY: number;
  scrollMaxY: number;
};

export type StepAction = "click" | "type" | "scroll" | "info" | "show";

// The model's guess of the step after this one (ARCHITECTURE 12.3).
export type PredictedStep = {
  action: "click" | "type" | "show";
  role: string;
  label: string;
  instruction: string;
};

export type Step = {
  reasoning: string;
  action: StepAction;
  elementId: number | null;
  scrollDirection: "up" | "down" | null;
  instruction: string;
  confidence: "high" | "medium" | "low";
  done: boolean;
  next?: PredictedStep | null;
};

export type StepOutcome =
  | "completed"
  | "clicked_elsewhere"
  | "scrolled"
  | "confirmed"
  | "page_changed"
  | "target_covered";

export type HistoryEntry = {
  turn: number;
  action: StepAction;
  instruction: string;
  elementLabel: string | null;
  outcome: StepOutcome;
  url: string;
};

export type StageTimings = {
  settleMs?: number;
  scanMs: number;
  captureMs: number;
  marksMs: number;
};

export type NextStepRequest = {
  sessionId: string;
  turn: number;
  goal: string;
  page: PageInfo;
  elements: ElementInfo[];
  history: HistoryEntry[];
  screenshot: string;
  timings?: StageTimings;
};

export type NextStepResponse =
  | { ok: true; step: Step; latencyMs: number; provider: string; model: string }
  | { ok: false; error: string; retryable: boolean };

export const STEP_JSON_SCHEMA = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    action: { type: "string", enum: ["click", "type", "scroll", "info", "show"] },
    elementId: { type: ["integer", "null"] },
    scrollDirection: { type: ["string", "null"], enum: ["up", "down", null] },
    instruction: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    done: { type: "boolean" },
    next: {
      anyOf: [
        {
          type: "object",
          properties: {
            action: { type: "string", enum: ["click", "type", "show"] },
            role: { type: "string" },
            label: { type: "string" },
            instruction: { type: "string" },
          },
          required: ["action", "role", "label", "instruction"],
        },
        { type: "null" },
      ],
    },
  },
  required: [
    "reasoning",
    "action",
    "elementId",
    "scrollDirection",
    "instruction",
    "confidence",
    "done",
  ],
  propertyOrdering: [
    "reasoning",
    "action",
    "elementId",
    "scrollDirection",
    "instruction",
    "confidence",
    "done",
    "next",
  ],
};

// Landmarks: plain text the model may only point at with "show".
export const LANDMARK_ROLES = new Set(["text", "heading"]);

const ELEMENT_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "tab",
  "menuitem",
  "option",
  "switch",
  "other",
  "text",
  "heading",
]);

const STEP_ACTIONS = new Set<string>(["click", "type", "scroll", "info", "show"]);
const ELEMENT_ACTIONS = new Set<string>(["click", "type", "show"]);

// ARCHITECTURE 6.2: max 150 interactive elements + max 40 landmarks.
const MAX_INTERACTIVE = 150;
const MAX_LANDMARKS = 40;
const STEP_OUTCOMES = new Set<string>([
  "completed",
  "clicked_elsewhere",
  "scrolled",
  "confirmed",
  "page_changed",
  "target_covered",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateElement(el: unknown, idx: number): string | null {
  if (!isRecord(el)) return `elements[${idx}] is not an object`;
  if (typeof el.id !== "number") return `elements[${idx}].id must be a number`;
  if (typeof el.role !== "string" || !ELEMENT_ROLES.has(el.role)) {
    return `elements[${idx}].role must be one of the allowed roles`;
  }
  if (typeof el.label !== "string") return `elements[${idx}].label must be a string`;
  if (el.inputType !== undefined && typeof el.inputType !== "string") {
    return `elements[${idx}].inputType must be a string if present`;
  }
  if (el.hasValue !== undefined && typeof el.hasValue !== "boolean") {
    return `elements[${idx}].hasValue must be a boolean if present`;
  }
  if (el.focused !== undefined && typeof el.focused !== "boolean") {
    return `elements[${idx}].focused must be a boolean if present`;
  }
  if (el.checked !== undefined && typeof el.checked !== "boolean") {
    return `elements[${idx}].checked must be a boolean if present`;
  }
  if (!isRecord(el.rect)) return `elements[${idx}].rect is required`;
  const { x, y, w, h } = el.rect;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof w !== "number" ||
    typeof h !== "number"
  ) {
    return `elements[${idx}].rect must have numeric x, y, w, h`;
  }
  return null;
}

function validateHistoryEntry(h: unknown, idx: number): string | null {
  if (!isRecord(h)) return `history[${idx}] is not an object`;
  if (typeof h.turn !== "number") return `history[${idx}].turn must be a number`;
  if (typeof h.action !== "string" || !STEP_ACTIONS.has(h.action)) {
    return `history[${idx}].action must be a valid StepAction`;
  }
  if (typeof h.instruction !== "string") return `history[${idx}].instruction must be a string`;
  if (h.elementLabel !== null && typeof h.elementLabel !== "string") {
    return `history[${idx}].elementLabel must be a string or null`;
  }
  if (typeof h.outcome !== "string" || !STEP_OUTCOMES.has(h.outcome)) {
    return `history[${idx}].outcome must be a valid StepOutcome`;
  }
  if (typeof h.url !== "string") return `history[${idx}].url must be a string`;
  return null;
}

export function validateRequest(body: unknown): NextStepRequest | string {
  if (!isRecord(body)) return "Request body must be a JSON object";

  if (typeof body.sessionId !== "string" || body.sessionId.length === 0) {
    return "sessionId must be a non-empty string";
  }
  if (typeof body.turn !== "number") return "turn must be a number";
  if (typeof body.goal !== "string" || body.goal.length === 0) {
    return "goal must be a non-empty string";
  }

  if (!isRecord(body.page)) return "page is required";
  const page = body.page;
  if (typeof page.url !== "string") return "page.url must be a string";
  if (typeof page.title !== "string") return "page.title must be a string";
  if (!isRecord(page.viewport)) return "page.viewport is required";
  if (typeof page.viewport.width !== "number" || typeof page.viewport.height !== "number") {
    return "page.viewport.width and height must be numbers";
  }
  if (typeof page.devicePixelRatio !== "number") return "page.devicePixelRatio must be a number";
  if (typeof page.scrollY !== "number") return "page.scrollY must be a number";
  if (typeof page.scrollMaxY !== "number") return "page.scrollMaxY must be a number";

  if (!Array.isArray(body.elements)) return "elements must be an array";
  for (let i = 0; i < body.elements.length; i++) {
    const err = validateElement(body.elements[i], i);
    if (err) return err;
  }
  const landmarks = body.elements.filter((el) => LANDMARK_ROLES.has((el as ElementInfo).role)).length;
  if (landmarks > MAX_LANDMARKS) return `elements must have at most ${MAX_LANDMARKS} landmarks`;
  if (body.elements.length - landmarks > MAX_INTERACTIVE) {
    return `elements must have at most ${MAX_INTERACTIVE} interactive entries`;
  }

  if (!Array.isArray(body.history)) return "history must be an array";
  if (body.history.length > 12) return "history must have at most 12 entries";
  for (let i = 0; i < body.history.length; i++) {
    const err = validateHistoryEntry(body.history[i], i);
    if (err) return err;
  }

  if (typeof body.screenshot !== "string" || body.screenshot.length === 0) {
    return "screenshot must be a non-empty string";
  }
  if (body.screenshot.startsWith("data:")) {
    return "screenshot must not include a data: prefix";
  }

  if (body.timings !== undefined) {
    if (!isRecord(body.timings)) return "timings must be an object if present";
    for (const key of ["settleMs", "scanMs", "captureMs", "marksMs"]) {
      const v = body.timings[key];
      const optional = key === "settleMs";
      if (v === undefined && optional) continue;
      if (typeof v !== "number") return `timings.${key} must be a number`;
    }
  }

  return body as unknown as NextStepRequest;
}

export type StepValidation = { ok: true } | { ok: false; reason: string; note: string };

// Checks a parsed Step against this request's element list. On failure, `note`
// is what the model is told on its one retry.
// Pixels of slack when deciding the page is at its top/bottom edge.
const SCROLL_EDGE_PX = 2;

export function validateStep(step: Step, elements: ElementInfo[], page?: PageInfo): StepValidation {
  if (ELEMENT_ACTIONS.has(step.action)) {
    if (step.elementId === null) {
      return {
        ok: false,
        reason: `action "${step.action}" requires a non-null elementId`,
        note: `A "${step.action}" step needs an elementId from the ELEMENTS list.`,
      };
    }
    const el = elements.find((e) => e.id === step.elementId);
    if (!el) {
      return {
        ok: false,
        reason: `elementId ${step.elementId} does not exist in the element list`,
        note: `Element ${step.elementId} does not exist. Pick from the list.`,
      };
    }
    if ((step.action === "click" || step.action === "type") && LANDMARK_ROLES.has(el.role)) {
      return {
        ok: false,
        reason: `${step.action} on landmark ${step.elementId} (${el.role})`,
        note: `Element ${step.elementId} is plain text. Use show for text, or pick a button/field.`,
      };
    }
    if (step.action === "type" && el.role !== "textbox" && el.role !== "combobox") {
      console.warn(
        `validateStep: type targeting elementId ${step.elementId} with role "${el.role}" (expected textbox/combobox)`
      );
    }
  }
  if (step.action === "scroll" && step.scrollDirection === null) {
    return {
      ok: false,
      reason: `action "scroll" requires a non-null scrollDirection`,
      note: `A "scroll" step needs scrollDirection "up" or "down".`,
    };
  }
  // Scrolling toward an edge the page is already at can never happen, so the
  // user would wait forever for a scroll that does nothing.
  if (step.action === "scroll" && page) {
    const atBottom = page.scrollY >= page.scrollMaxY - SCROLL_EDGE_PX;
    const atTop = page.scrollY <= SCROLL_EDGE_PX;
    if ((step.scrollDirection === "down" && atBottom) || (step.scrollDirection === "up" && atTop)) {
      const edge = step.scrollDirection === "down" ? "bottom" : "top";
      return {
        ok: false,
        reason: `scroll ${step.scrollDirection} but the page is already at the ${edge}`,
        note:
          `The page is already scrolled to the ${edge} and cannot scroll ${step.scrollDirection}: everything on that side is already on screen. ` +
          `Pick an element from the ELEMENTS list. If an element you pointed at earlier is gone or changed after a completed step, that step worked; if the goal is achieved, answer done: true.`,
      };
    }
  }
  return { ok: true };
}

const CONFIDENCES = new Set<string>(["high", "medium", "low"]);

// Pulls the first balanced {...} block out of model text (tolerates ``` fences
// and chatter around the JSON). Braces inside JSON strings are skipped.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Turns raw model output into a Step, or throws with a short reason.
export function parseStepText(text: string): Step {
  const json = extractJsonObject(text);
  if (!json) throw new Error("no JSON object in model output");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("model output JSON does not parse");
  }
  return parseStepObject(raw);
}

// Strict on the fields that drive behavior (action, elementId, instruction);
// normalizes the ones that are unambiguous (a numeric-string id, a missing
// reasoning, an elementId/scrollDirection the action does not use). An invalid
// `next` is dropped, never fails the step.
export function parseStepObject(raw: unknown): Step {
  if (!isRecord(raw)) throw new Error("model output is not a JSON object");

  const action = raw.action;
  if (typeof action !== "string" || !STEP_ACTIONS.has(action)) {
    throw new Error(`invalid action ${JSON.stringify(action)}`);
  }
  let elementId: number | null = null;
  if (typeof raw.elementId === "number" && Number.isInteger(raw.elementId)) {
    elementId = raw.elementId;
  } else if (typeof raw.elementId === "string" && /^\d+$/.test(raw.elementId.trim())) {
    elementId = Number(raw.elementId.trim());
  } else if (raw.elementId !== null && raw.elementId !== undefined) {
    throw new Error(`invalid elementId ${JSON.stringify(raw.elementId)}`);
  }
  if (typeof raw.instruction !== "string" || raw.instruction.trim() === "") {
    throw new Error("missing instruction");
  }
  const scrollDirection =
    raw.scrollDirection === "up" || raw.scrollDirection === "down" ? raw.scrollDirection : null;
  const confidence =
    typeof raw.confidence === "string" && CONFIDENCES.has(raw.confidence)
      ? (raw.confidence as Step["confidence"])
      : "medium";
  const done = raw.done === true;

  const step: Step = {
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
    action: action as StepAction,
    elementId: ELEMENT_ACTIONS.has(action) ? elementId : null,
    scrollDirection: action === "scroll" ? scrollDirection : null,
    instruction: raw.instruction.trim(),
    confidence,
    done,
  };
  const next = parsePredicted(raw.next);
  if (next) step.next = next;
  return step;
}

const PREDICTED_ACTIONS = new Set<string>(["click", "type", "show"]);

function parsePredicted(raw: unknown): PredictedStep | null {
  if (!isRecord(raw)) return null;
  const { action, role, label, instruction } = raw;
  if (typeof action !== "string" || !PREDICTED_ACTIONS.has(action)) return null;
  if (typeof role !== "string" || !ELEMENT_ROLES.has(role)) return null;
  if (typeof label !== "string" || label.trim() === "") return null;
  if (typeof instruction !== "string" || instruction.trim() === "") return null;
  return {
    action: action as PredictedStep["action"],
    role,
    label: label.trim().slice(0, 80),
    instruction: instruction.trim(),
  };
}
