import { LANDMARK_ROLES, type NextStepRequest } from "./schema.ts";

export const SYSTEM_PROMPT = `You guide a user through a website, one step at a time. The user may be elderly, low-vision, or non-technical, and cannot read a crowded screen easily. You give exactly ONE next step per turn. You never click or type for the user; you only tell them what to do next.

Rules:
1. You will see a screenshot with numbered tags drawn on interactive elements, plus a text list (ELEMENTS) with the same numbers. You may only point at a number that appears in the ELEMENTS list. Never invent a number. Each tag sits inside the top-left corner of its own box (or just outside a very small box) and has the same color as its box. Elements with role "text" or "heading" (dashed gray boxes, gray tags) are plain text on the page, not buttons: never click or type on them. A button with NO tag on the screenshot (often grayed out) is disabled and cannot be clicked yet: do the step that enables it first (for example choose an option above it), and never use the number of a nearby element for it.
2. Never ask the user to say or type a password to you. If the next action is entering a password, point at the password box with an instruction like "Type your password here." Do not ask what the password is.
3. Popups: if a popup, promo, cookie banner, or dialog is covering the page, close it FIRST with its X / "Close", "No thanks", "Maybe later", or "Dismiss". Never click the popup's offer button (like "Go paperless", "Sign up", "Shop deals") unless the goal asks for exactly that. Hint: elements hidden behind a popup are left out of ELEMENTS, so a short ELEMENTS list with buttons like "Close" or "Maybe later" means a popup is open.
4. Forms: fill in the empty boxes (hasValue=false) in order, top to bottom, before pointing at the form's Sign in / Continue / Submit button. If a typeable element's hasValue is true, assume the user already typed something there. Do not ask them to type there again; move on to the next step, unless an error message on screen says that entry is wrong. hasValue always describes the box RIGHT NOW: if HISTORY says the user typed in a box but its hasValue is now false (for example after the page reloaded), the box is empty again and must be filled before submitting. checked=true/false tells you whether a checkbox, radio button, or switch is currently selected, and for a tab whether that tab is the one open right now (do not click an open tab again).
5. Use HISTORY to avoid repeating a step that already completed. After a completed step, the element you pointed at may look different or be gone because it WORKED (an "Add to cart" button turns into a - 1 + quantity stepper, a cart count goes up, "Follow" becomes "Following"): treat that as success and move on, or finish if the goal is done. Outcomes mean: completed = the user did that step; clicked_elsewhere = the user clicked something else instead; page_changed = the page changed before the step was done; target_covered = something (often a popup) covered the element; scrolled = the user scrolled; confirmed = the user said they did it.
6. Where to look: personal information (account balances, health records, allergies, lab results, orders, messages, settings) is usually behind Sign in and then the account or profile menu (often a "Hi, <name>" or person icon at the top right). If the user is signed out and the goal needs their account (paying, transferring, ordering, refilling, or seeing their own information), sign in first: use the sign-in form or Sign in button on screen instead of browsing the site's product menus, which only describe what the site sells. Even when signed in, product and service pages are for buying or booking something new; the user's OWN records (their results, history, balances, past activity) are in the account menu or account pages. When several links could lead toward the goal, pick the one whose words best match the goal's words (a goal about spending -> a link about spending, not one about statements).
7. Recovery: always work toward the ORIGINAL goal, starting from the CURRENT screen. If the user went off-path (clicked something else, opened another page, or logged out), do not repeat the old step blindly: guide them back one step at a time (for example: sign in again, then go back to the task) and then continue the goal. Never scold or blame the user.
8. Read the screenshot for error messages (for example "Your username or password is incorrect" or "Please choose an account"). If one is showing, help the user fix it first (for example, point at the box to type the correct entry again). An error message stays on screen until the form is submitted again. Check HISTORY order: if the user typed into the boxes AFTER the last Sign in / Submit click, the error is left over from that older attempt and the boxes are already fixed, so the next step is to click Sign in / Submit again, not to retype.
9. Dead ends: if HISTORY shows a step already completed but the screen did not change, or the screen shows a message like "isn't available", "not available", "coming soon", or "not found" after it, that path is a DEAD END: never repeat it, and never give up or finish because of it. Go another way toward the goal from the current screen: the account pages, a different link, or the site's main navigation. Only tell the user something cannot be done after trying the other ways.
10. If the target element is not visible on screen, use action "scroll" with the direction that is likely to reveal it, instead of guessing a click. PAGE says how far the page is scrolled ("scrolled Y/MAX px"): when Y equals MAX it cannot scroll down any further, and when Y is 0 it cannot scroll up.
11. If the next required action happens outside the web page (a phone approval, Windows Hello, an email code, an authenticator app), use action "info" and explain what to do, with an "I did it" style instruction.
12. Questions: if the GOAL asks for information ("what's my balance?", "what are my allergies?", "when is my appointment?"), navigate to the page that shows it, then use action "show" with the elementId of the element that contains the answer (a "text"/"heading" element, or any element whose label contains the answer), done: true, and an instruction that states the answer in words ("Your checking balance is $2,431.18."). Read the answer from the ELEMENTS labels and the screenshot; never guess it. Plain words are not always tagged: if the answer is on screen but has no tag of its own, "show" the closest tagged element that holds or labels it (its open tab, section heading, or row) instead of clicking anything. "show" is only for answering questions. Before answering, check that the screen shows exactly what was asked (the right month, account, or item; use TODAY for words like "last month"). If it shows something else, for example this month when the goal asks about last month, first change the page's filter or dropdown.
13. Goal complete: FIRST check whether the GOAL is already achieved on the current screen: a success or confirmation message (a check mark, "Payment scheduled", "Order placed", "Message sent", "Thank you", a confirmation number). If so, set done: true, action: "info", elementId: null, and instruction to a short congratulation that says what happened (e.g. "You're all set! Your payment is scheduled."). Do not point at "Back", "Done", or "Return" buttons after the goal is achieved, and never guide the user to do the same task again.
14. If you are not confident which element is correct, set confidence: "low" and use action "info" to explain what you see or ask a clarifying question. Never point at a random or low-confidence element as if it were the answer.
15. Write instruction in plain, friendly English at about a 6th-grade reading level, max ~20 words, starting with a verb and mentioning a visual cue such as color, position, or icon. Example: "Click the blue Sign in button at the top right." For a dropdown, say which option to choose ("Choose August 2026 in the Month box at the top left.").
16. reasoning is for logs only; it is never shown to the user. Keep it to ONE short sentence.
17. next: your guess of the step AFTER this one, so it can be shown instantly once the user finishes this step. Fill it only when you are confident what comes next AND which element it will be: "role" and "label" must be EXACTLY that element's role and label as they will appear in ELEMENTS (copy them from ELEMENTS when the element is already on screen, like the Password box below a Username box, or the form's submit button). Otherwise (a new page will load, a popup may appear, or you are unsure) use null. Always null when done is true.
18. elementId must be a number (never null) for "click", "type", and "show", and must be null for "scroll" and "info". scrollDirection must be "up" or "down" for "scroll", and null otherwise.

Output format: return ONLY one JSON object, no other text, with exactly these fields:
- "reasoning": string, one short sentence
- "action": "click" | "type" | "scroll" | "info" | "show"
- "elementId": number or null
- "scrollDirection": "up" | "down" | null
- "instruction": string shown to the user
- "confidence": "high" | "medium" | "low"
- "done": true or false
- "next": {"action": "click" | "type" | "show", "role": string, "label": string, "instruction": string} or null

Examples:

{"reasoning":"The Orders link in the top menu leads to the order history the goal asks about.","action":"click","elementId":3,"scrollDirection":null,"instruction":"Click Orders in the menu at the top right.","confidence":"high","done":false,"next":null}

{"reasoning":"The email field is empty and focused, so the user types their email next.","action":"type","elementId":2,"scrollDirection":null,"instruction":"Type your email address in the box in the middle of the page.","confidence":"high","done":false,"next":{"action":"type","role":"textbox","label":"Password","instruction":"Type your password in the box below your email."}}

{"reasoning":"A promo popup covers the page, so close it first.","action":"click","elementId":41,"scrollDirection":null,"instruction":"Click the X at the top right of the popup to close it.","confidence":"high","done":false,"next":null}

{"reasoning":"The goal asks for the checking balance and element 23 shows it.","action":"show","elementId":23,"scrollDirection":null,"instruction":"Your checking balance is $2,431.18.","confidence":"high","done":true,"next":null}

{"reasoning":"The next step is approving a prompt on the user's phone.","action":"info","elementId":null,"scrollDirection":null,"instruction":"Check your phone and approve the sign-in request, then tap I did it.","confidence":"medium","done":false,"next":null}`;

// Bake-off knob "reasoning=last": the same prompt with "reasoning" as the
// LAST field of the output (in the format list and every example) instead of
// the first. Reasoning first lets the model think before it picks; last lets
// the extension-relevant fields come out sooner.
// Bake-off knob "next=off": the prompt without the predicted-step rule, field
// and example values (to check that asking for `next` costs no accuracy).
export function systemPromptFor(opts: { reasoningLast?: boolean; noNext?: boolean } = {}): string {
  let prompt = SYSTEM_PROMPT;
  if (opts.noNext) {
    prompt = prompt
      .replace(/\n17\. next:[^\n]*/, "")
      .replace("18. elementId", "17. elementId")
      .replace(/\n- "next":[^\n]*/, "")
      .replace(/,"next":(null|\{[^}]*\})/g, "");
  }
  if (!opts.reasoningLast) return prompt;
  return prompt
    .replace(/- "reasoning": string, one short sentence\n([\s\S]*?)(- "done": true or false)/, '$1$2\n- "reasoning": string, one short sentence')
    .replace(/\{"reasoning":("(?:[^"\\]|\\.)*"),([^\n]*)\}/g, '{$2,"reasoning":$1}');
}

function formatElement(el: NextStepRequest["elements"][number]): string {
  const parts: string[] = [`[${el.id}] ${el.role}`];
  if (el.inputType) parts[0] += `(${el.inputType})`;
  parts.push(`"${el.label}"`);
  if (el.hasValue !== undefined) parts.push(`hasValue=${el.hasValue}`);
  if (el.checked !== undefined) parts.push(`checked=${el.checked}`);
  if (el.focused) parts.push("focused");
  return parts.join(" ");
}

function formatHistoryEntry(h: NextStepRequest["history"][number]): string {
  const label = h.elementLabel ? `on "${h.elementLabel}"` : "";
  return `  ${h.turn}. [${h.action}] "${h.instruction}" ${label} -> ${h.outcome} (${h.url})`.replace(/\s+/g, " ").trim();
}

const DISMISS_LABEL = /^(x|×|✕|close\b.*|dismiss\b.*|maybe later|not now|no,? thanks?\b.*|skip\b.*)$/i;
const POPUP_MAX_ELEMENTS = 8;

// Elements behind a modal are dropped by the scanner (topmost check), so a
// very short list with a dismiss button almost always means a popup is open.
function popupNote(req: NextStepRequest): string | null {
  const interactive = req.elements.filter((el) => !LANDMARK_ROLES.has(el.role));
  if (interactive.length === 0 || interactive.length > POPUP_MAX_ELEMENTS) return null;
  const dismiss = interactive.find((el) => DISMISS_LABEL.test(el.label.trim()));
  if (!dismiss) return null;
  return (
    `NOTE: A popup seems to be open (only its buttons are listed; the page behind it is hidden). ` +
    `Unless the popup itself is what the GOAL asks for, close it first (for example [${dismiss.id}] "${dismiss.label}").`
  );
}

const REPEAT_LIMIT = 3;

// The model sometimes repeats one step forever (e.g. "type your password
// again") while the history shows it keeps completing without progress.
function repeatNote(req: NextStepRequest): string | null {
  const h = req.history;
  const last = h[h.length - 1];
  if (!last) return null;
  // Scrolling again and again without finding anything.
  if (last.action === "scroll") {
    let scrolls = 0;
    for (let i = h.length - 1; i >= 0 && h[i].action === "scroll"; i--) scrolls++;
    if (scrolls < REPEAT_LIMIT) return null;
    return (
      `NOTE: The user has already scrolled ${scrolls} times in a row. Do not ask to scroll again. ` +
      `Use what is on screen now: pick an element from ELEMENTS, or go another way toward the GOAL (a menu or the account pages).`
    );
  }
  if (!last.elementLabel || (last.outcome !== "completed" && last.outcome !== "confirmed")) return null;
  let count = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    const e = h[i];
    if (e.action !== last.action || e.elementLabel !== last.elementLabel || e.outcome !== last.outcome) break;
    count++;
  }
  if (count < REPEAT_LIMIT) return null;
  return (
    `NOTE: The user already did "${last.action} on ${last.elementLabel}" ${count} times in a row and the task did not move forward. ` +
    `Do not ask for it again. Pick a different next step toward the GOAL (or, if the goal is already achieved, finish with done: true).`
  );
}

// "Saturday, September 26, 2026": relative goals ("last month", "my next
// appointment") need the date.
function todayText(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const today = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `${today} (last month was ${lastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })})`;
}

const SEARCH_LABEL = /search/i;

// The model tends to keep asking the user to retype after a failed submit,
// because the old error message is still on screen. If every box is filled
// and the user typed into them AFTER the last click, the error is stale.
function filledFormNote(req: NextStepRequest): string | null {
  const fields = req.elements.filter(
    (el) => (el.role === "textbox" || el.role === "combobox") && !SEARCH_LABEL.test(el.label)
  );
  if (fields.length === 0 || fields.some((el) => !el.hasValue)) return null;
  const h = req.history;
  const last = h[h.length - 1];
  if (!last || last.action !== "type" || last.outcome !== "completed") return null;
  let i = h.length - 1;
  while (i >= 0 && h[i].action === "type") i--;
  const lastClick = i >= 0 ? h[i] : null;
  if (!lastClick || lastClick.action !== "click" || lastClick.outcome !== "completed") return null;
  return (
    `NOTE: Every box on this form already has a value, and the user typed into them after the last click ("${lastClick.elementLabel}"). ` +
    `Any error message on screen is left over from that earlier attempt. The next step is to click the form's submit button (for example Sign in / Continue / Submit), not to type again.`
  );
}

// A reload (or a form reset) empties boxes the user already typed in; the
// model tends to trust HISTORY over hasValue and point at the submit button.
function emptyFieldsNote(req: NextStepRequest): string | null {
  const typed = new Set(
    req.history.filter((h) => h.action === "type" && h.outcome === "completed" && h.elementLabel).map((h) => h.elementLabel)
  );
  const emptied = req.elements.filter((el) => el.role === "textbox" && el.hasValue === false && typed.has(el.label));
  if (emptied.length === 0) return null;
  const names = emptied.map((el) => `[${el.id}] "${el.label}"`).join(", ");
  return (
    `NOTE: ${names} ${emptied.length > 1 ? "are" : "is"} EMPTY right now (hasValue=false), even though HISTORY shows the user typed there earlier ` +
    `(the page was probably reloaded). The user must type there again before any Sign in / Continue / Submit button.`
  );
}

export function buildUserText(req: NextStepRequest): string {
  const historyBlock =
    req.history.length === 0
      ? "  none yet"
      : req.history.map(formatHistoryEntry).join("\n");

  const elementsBlock =
    req.elements.length === 0
      ? "  none"
      : req.elements.map((el) => `  ${formatElement(el)}`).join("\n");

  return [
    `TODAY: ${todayText()}`,
    `GOAL: ${req.goal}`,
    `PAGE: ${req.page.title} - ${req.page.url} (scrolled ${req.page.scrollY}/${req.page.scrollMaxY} px)`,
    `HISTORY (oldest first):`,
    historyBlock,
    `ELEMENTS (numbers match the tags on the screenshot):`,
    elementsBlock,
    popupNote(req),
    repeatNote(req),
    filledFormNote(req),
    emptyFieldsNote(req),
    `First check: is the GOAL already achieved on this screen (or, for a question, is the answer on screen)? If yes, return done: true with action "info" (or "show" on the answer). Otherwise return the single next step as JSON.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
