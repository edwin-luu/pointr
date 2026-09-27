# Pointr - Architecture

How Pointr works, the decisions behind it, and the exact data contracts between its parts. Contracts in section 6 are binding: code on both sides of a message or HTTP call follows them exactly. Code comments refer to this file by section number.

## 1. Product in one paragraph

A user who is unsure how to use a website opens the small Pointr widget (bottom-right launcher, or `Alt+X`) and types or speaks ONE goal ("pay my credit card bill"). Pointr looks at the current screen, decides the single next action, glides a large yellow ghost cursor to the right element, draws a yellow ring around it with the rest of the page dimmed, and shows a short caption. When the user performs the action, Pointr looks again and shows the next step, until the goal is done. Then the widget shows "You did it!" and goes quiet until the next goal. Pointr never clicks or types for the user and never speaks aloud.

Demo: three mock web apps (bank, pharmacy, grocery) running locally in Docker, plus a Demo Hub to reset them and tune random popups. Nothing in Pointr is specific to the mock apps; it also runs on real sites (tested by hand on Outlook and Amazon).

Pointr is not a chatbot: there is no chat transcript, only a goal box and the on-page pointer.

## 2. Decisions (and why)

| # | Decision | Why |
|---|----------|-----|
| D1 | Chrome extension (Manifest V3) | Reads the DOM, so rings are pixel-exact from `getBoundingClientRect()`; the model never guesses coordinates. |
| D2 | Model provider is pluggable. Default: **Amazon Bedrock, Nova 2 Lite** (`us.amazon.nova-2-lite-v1:0`). Switch to Gemini by editing one line in `server/.env`. Automatic fallback to **Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`) when Bedrock auth fails. | Bake-off on 39 captured screens x 3 runs: Nova 2 Lite 97% correct at p90 1.5 s; Nova Lite 74%; Nova Pro 55%. Gemini 3.1 Flash Lite answered correctly whenever it was not rate-limited (p50 2.2 s). Claude Haiku 4.5 on Bedrock was slower (~4 s) and confused by the page. Bedrock API keys on the team account last 12 hours, so the fallback protects a demo; it can only be Gemini, since any Bedrock model dies with the Bedrock key. |
| D3 | Small local backend (Node 24, TypeScript run directly, `node:http`) | Keeps keys off the client, one place to swap models and prompts, logs every request. |
| D4 | Extension in plain JS, no bundler | Edit, reload in `chrome://extensions`. |
| D5 | One step at a time loop (observe -> ask -> point -> wait -> repeat), **event-driven, never time-polled** | A model call happens only when something meaningful happens (user acted, page changed, target got covered by a popup). Cheaper and faster than screenshots every 1-2 s. |
| D6 | Set-of-Marks grounding | The model gets a numbered element list + a screenshot with the same numbers drawn; it answers with an element id. |
| D7 | Step actions: `click`, `type`, `scroll`, `info`, `show`, plus a `done` flag | `show` points at non-clickable information (a balance, a lab result) for "tell me" goals. |
| D8 | Layered overlay handoff | The ghost cursor fades when the real cursor is near; the ring stays until the action is done. |
| D9 | Voice input only, push-to-talk. `Alt+X` or the mic button starts recording, press again to stop, transcribe, auto-send. Audio is recorded in an extension **offscreen document** and transcribed by a **local Whisper container**. | Mic permission is granted ONCE to the extension instead of once per website. Whisper `base.en` on a laptop CPU transcribes a 5 s clip in about 0.8 s. No voice output at all. |
| D10 | Session state in the service worker + `chrome.storage.session`, keyed by tab id | Survives page loads and cross-domain redirects. The widget rebuilds itself on every full page load from this state, so it looks continuous. |
| D11 | All Pointr UI inside a closed Shadow DOM on `<pointr-root>` | Page CSS cannot break our UI and vice versa. |
| D12 | The element list never includes field values (only `hasValue`) | Basic privacy hygiene. |
| D13 | Wrong clicks are never blocked. Pointr re-plans from the new screen toward the ORIGINAL goal (e.g. the user logged out mid-payment -> guide them to log back in, then continue paying). After 3 off-path actions in a row the widget asks "Still want help with: <goal>?" [Keep going] [Stop]. | Real users may abandon or detour; blocking breaks real sites. |
| D14 | The mock apps contain NO Pointr-specific hints (no `data-pointr`, no special ids). They are ordinary, realistically busy, well-labeled React sites. | Honest answer to "does it work on real sites?". |
| D15 | Overlay look: yellow `#FFD23F` ring + cursor + caption, dimmed page, Atkinson Hyperlegible. Dim amount is a tunable constant (default `0.52`). | High contrast, legible for low-vision users. |
| D16 | No progress bar or step count estimate. The caption eyebrow says "Step N" only. | The model plans one step at a time; a wrong total looks worse than none. |
| D17 | Speed stack: stage timings in the logs, cheap model settings, hedged requests, predicted next step for instant pointing. No local vision model. | A CPU-only laptop would take 10-60 s per screenshot. See section 12. |

Out of scope today: "Hey Pointr" wake word, languages other than English, iframes, voice output, acting on the user's behalf.

## 3. Components

```
+----------------------------- Chrome ---------------------------------------+
|                                                                            |
|  CONTENT SCRIPT (per page, UI in closed Shadow DOM on <pointr-root>)       |
|   styles.js   CSS for the shadow root                                      |
|   config.js   visual tunables (dim, ring, cursor, proximity)               |
|   icons.js    SVG icons (createElementNS, no innerHTML)                    |
|   scanner.js  interactive elements + text landmarks -> ElementInfo[]       |
|   overlay.js  ghost cursor, ring + dim, caption, cards                     |
|   watcher.js  detects the user's action -> StepOutcome                     |
|   widget.js   launcher + goal box (text, mic, Send, Close) + states        |
|   voice.js    mic button / Alt+X glue (recording lives in offscreen)       |
|   main.js     message wiring, font loading (LAST in the manifest list)     |
|                    ^            |  chrome.runtime messages (6.3)            |
|                    |            v                                           |
|  SERVICE WORKER background.js (ES module)                                  |
|   sw/session.js  per-tab Session in chrome.storage.session                 |
|   sw/loop.js     observe -> ask -> point -> wait state machine             |
|   sw/marks.js    captureVisibleTab + draw Set-of-Marks (OffscreenCanvas)   |
|   sw/api.js      POST /next-step                                           |
|   sw/voice.js    offscreen document lifecycle, Alt+X command               |
|  OFFSCREEN DOC offscreen/offscreen.html+js  MediaRecorder -> /transcribe    |
|  WELCOME TAB   welcome/welcome.html  one-time "Allow microphone"           |
+--------------------------------|-------------------------------------------+
                                 | HTTP http://localhost:8787
+---------------- server/ (Node 24) -----------------------------------------+
|  server.ts        GET /health, POST /next-step, POST /transcribe           |
|  schema.ts        types + JSON schema + validation                         |
|  prompt.ts        system prompt + per-request prompt builder               |
|  decide.ts        model answer -> Step (validation retries, guards)        |
|  providers/       index.ts (pick, hedge, fallback), bedrock.ts, gemini.ts  |
|  transcribe.ts    forwards audio to Whisper                                |
|  logger.ts        server/logs/<ts>-<session>-<turn>/ + timings.csv         |
|  voice/           Docker: faster-whisper HTTP service on :8790             |
+----------------------------------------------------------------------------+
+---------------- demo-apps/ (Docker Compose) --------------------------------+
|  hub :3000   bank :3001   pharmacy :3002   grocery :3003                    |
+----------------------------------------------------------------------------+
```

## 4. Repository layout

```
pointr/
  README.md  CLAUDE.md
  docs/ARCHITECTURE.md  docs/MOCK-APPS.md
  demo-apps/                        hub/ bank/ pharmacy/ grocery/ shared/ + docker-compose.yml (see docs/MOCK-APPS.md)
  server/
    server.ts schema.ts prompt.ts decide.ts logger.ts transcribe.ts
    providers/index.ts providers/bedrock.ts providers/gemini.ts providers/types.ts
    scripts/try-fixture.ts bakeoff.ts make-fixture.ts timings.ts
    fixtures/<name>/{request.json, screenshot.jpg, expected.json}
    voice/Dockerfile voice/app.py voice/samples/    docker-compose.yml (whisper)
    logs/  (gitignored)
  extension/
    manifest.json background.js
    sw/session.js sw/loop.js sw/marks.js sw/api.js sw/voice.js
    content/styles.js config.js icons.js scanner.js overlay.js watcher.js widget.js voice.js main.js
    offscreen/offscreen.html offscreen.js
    welcome/welcome.html welcome.js
    fonts/ (Atkinson Hyperlegible 400/700 woff2 + OFL.txt)
    icons/  scripts/gen-icons.mjs
  scripts/e2e/                      robot tester (Playwright Chromium + the real unpacked extension)
```

Content scripts are classic scripts sharing `globalThis.Pointr = globalThis.Pointr || {}`. Each file attaches its API (`Pointr.scanner = {...}`). `main.js` is last and wires everything.

## 5. The step loop (state machine in `sw/loop.js`)

```
            POINTR_START {goal}
                   |
                   v
   +--------> OBSERVING ---- SW -> content: POINTR_PREPARE_CAPTURE
   |               |          content hides ALL Pointr UI, scans, replies ScanResult
   |               |          SW: captureVisibleTab + draw marks   (UI STILL HIDDEN)
   |               v
   |           THINKING  ---- SW -> content: POINTR_THINKING (content un-hides UI, widget "Looking...")
   |               |          SW: POST /next-step
   |               v
   |        step.done && action=="info" --> DONE: POINTR_DONE {message}; clear session
   |               |
   |               v
   |       AWAITING_ACTION -- SW -> content: POINTR_STEP {turn, step}
   |               |          content: overlay points, watcher armed
   |               |          (a done:true "show" step also lands here; its "Got it" ends the session)
   |               |
   |      content -> SW: POINTR_STEP_RESULT {turn, outcome}   (sent the INSTANT the outcome is known)
   |               |          SW appends HistoryEntry, updates offPathStreak, turn++
   |               v
   |           SETTLING  ---- waits for EITHER
   |               |            content -> SW: POINTR_READY {turn}  (same page, DOM quiet)
   |               |            content -> SW: POINTR_HELLO {url}   (a new page loaded)
   |               |
   |      offPathStreak >= 3 ? --yes--> CHECKIN: POINTR_CHECKIN {goal}
   |               | no                  "Keep going" -> POINTR_CHECKIN_ANSWER {keepGoing:true} -> streak=0, OBSERVING
   +---------------+                     "Stop"       -> POINTR_STOP
```

Rules:
- **Capture order:** the screenshot is taken while Pointr's UI is hidden. `POINTR_THINKING` (which un-hides the UI) is sent only AFTER `captureWithMarks` resolves, so the model never sees Pointr's own widget.
- `turn` is a counter on the session; every turn-scoped message carries it. The SW ignores a `POINTR_STEP_RESULT`/`POINTR_READY` whose `turn` does not match (READY carries the NEW turn number, i.e. the one after the increment).
- Only one loop iteration in flight per tab: re-read the session and re-check `status` after every `await` (a run token per tab; a stale run stops at its next check).
- `POINTR_HELLO` while `settling` -> run the turn. While `awaiting_action` (the user navigated without a watcher event, e.g. back button or typed URL) -> record outcome `page_changed`, turn++, run the turn. While `observing`/`thinking` -> restart the current turn. While `checkin` -> resend `POINTR_CHECKIN`. While `error` -> re-run the turn (a reload acts as "Try again"). The HELLO reply always includes the session summary so the widget restores itself immediately.
- Content sends `POINTR_HELLO` only after `document.readyState === "complete"` AND the DOM is quiet for 500 ms (max wait 4 s).
- `offPathStreak`: `clicked_elsewhere` -> +1. `completed`, `confirmed`, `scrolled` -> reset to 0. `page_changed`, `target_covered` -> unchanged.
- `POINTR_STOP` clears the session from any state and sends `POINTR_ENDED`.
- Errors (backend down, timeout, invalid response): `POINTR_ERROR {message, retryable}`; the widget shows "Try again" -> `POINTR_RETRY` re-enters OBSERVING with the same turn.
- Max 40 turns -> `POINTR_ERROR {message: "This is taking longer than expected. Let's start over.", retryable: false}`, clear session.
- `chrome.tabs.captureVisibleTab` is rate-limited to 2 calls/s. Never call it twice within 600 ms.
- If `chrome.tabs.sendMessage` fails because no content script is loaded yet (page loading), do not error: leave the status and let `POINTR_HELLO` resume.
- A turn in a background tab pauses (captureVisibleTab would shoot the visible tab) and resumes on `tabs.onActivated`.
- Content replies `element_missing` when the target is gone or `location.href` differs from the scan's URL (the page moved on while thinking), so a stale step is never shown; the SW records `page_changed` and re-plans.
- **New tabs:** when a web page tab is opened FROM the guided tab (`tabs.onCreated` with `openerTabId`, e.g. a `target=_blank` link like Outlook's "Sign in") while the user is acting on a step (or within 10 s of the last outcome), the session moves to the new tab (same Session, new `tabId`; a turn in flight restarts on the new page's HELLO) and the old tab gets `POINTR_ENDED`. A STEP_RESULT the old page sends a moment later is recorded for the new tab. Ctrl+T tabs (no opener, not http/https) are ignored.
- Closing a tab clears its session.
- Predicted-step fast path: see section 12.3.

## 6. Contracts (binding)

### 6.1 Shared types

```ts
type ElementRole =
  | "button" | "link" | "textbox" | "checkbox" | "radio" | "combobox" | "tab"
  | "menuitem" | "option" | "switch" | "other"
  | "text" | "heading";        // landmarks: never click/type targets, only "show" targets

type ElementInfo = {
  id: number;            // 1..N, unique per scan, matches the number drawn on the screenshot
  role: ElementRole;
  label: string;         // best human label, trimmed, max 80 chars ("" if none)
  inputType?: string;    // for <input>: "email" | "password" | "text" | ...
  hasValue?: boolean;    // for typeable elements: true if non-empty. NEVER the value itself
  focused?: boolean;
  checked?: boolean;     // checkbox/radio/switch; tab: aria-selected (the open tab)
  rect: { x: number; y: number; w: number; h: number }; // viewport CSS px, rounded ints
};

type PageInfo = {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  scrollY: number;
  scrollMaxY: number;
};

type StepAction = "click" | "type" | "scroll" | "info" | "show";

type PredictedStep = {
  action: "click" | "type" | "show";
  role: ElementRole;
  label: string;                 // expected label of the next target, as it will appear in the next scan
  instruction: string;
};

type Step = {
  action: StepAction;
  elementId: number | null;      // required for click/type/show; null for scroll/info
  scrollDirection: "up" | "down" | null; // required for scroll; null otherwise
  instruction: string;           // shown to the user. Plain English, max ~20 words, 6th-grade level
  done: boolean;                 // goal achieved. Then action is "info" (no element) or "show" (points at the answer)
  confidence: "high" | "medium" | "low";
  reasoning: string;             // ONE short sentence, logs only, never shown
  next?: PredictedStep | null;   // the model's guess of the step after this one
};

type StepOutcome =
  | "completed"          // user did the asked action on the target
  | "clicked_elsewhere"  // user clicked a DIFFERENT interactive element (not Pointr UI, not plain text/background)
  | "scrolled"
  | "confirmed"          // "I did it" (info) or "Got it" (show)
  | "page_changed"       // URL changed or target detached without a prior outcome
  | "target_covered";    // target stayed covered by something else (popup, modal, ad) for 400 ms

type HistoryEntry = {
  turn: number;
  action: StepAction;
  instruction: string;
  elementLabel: string | null;
  outcome: StepOutcome;
  url: string;
};

type Session = {
  sessionId: string;
  tabId: number;
  goal: string;
  status: "observing" | "thinking" | "awaiting_action" | "settling" | "checkin" | "error" | "done";
  turn: number;                  // starts at 1
  history: HistoryEntry[];       // send the last 12 to the backend
  currentStep: Step | null;
  currentElementLabel: string | null;
  offPathStreak: number;
  predicted: PredictedStep | null;
  startedAt: number;
  // SW-internal bookkeeping (never sent to content or the backend):
  stepUrl: string | null;        // page URL where currentStep was shown -> HistoryEntry.url
  outcomeAt: number | null;      // Date.now() when the last StepOutcome arrived -> StageTimings.settleMs
};

type StageTimings = {            // measured by the SW for the turn being requested
  settleMs?: number;             // outcome -> READY/HELLO
  scanMs: number;                // PREPARE_CAPTURE round trip
  captureMs: number;             // captureVisibleTab
  marksMs: number;               // draw + encode
};
```

### 6.2 Backend HTTP API

`GET /health` -> `200 {"ok": true, "provider": "bedrock"|"gemini", "model": "<id>", "fallback": "gemini"|null}` (`fallback` is non-null while the automatic fallback is active).

`POST /next-step` (JSON body, max 8 MB)

```ts
type NextStepRequest = {
  sessionId: string;
  turn: number;
  goal: string;
  page: PageInfo;
  elements: ElementInfo[];       // max 150 interactive + max 40 landmarks
  history: HistoryEntry[];       // max 12, oldest first
  screenshot: string;            // base64 JPEG, NO "data:" prefix, marks drawn, max width 1280 px
  timings?: StageTimings;
};

type NextStepResponse =
  | { ok: true; step: Step; latencyMs: number; provider: string; model: string }
  | { ok: false; error: string; retryable: boolean };
```

Server-side validation after the provider answers (`decide.ts`):
- `click`/`type`/`show` with an `elementId` not in `elements` -> retry ONCE with note "Element N does not exist. Pick from the list." Still invalid -> fallback Step `{action:"info", elementId:null, confidence:"low", instruction:"I'm not sure where to click next. Try scrolling, or tell me more about what you want.", done:false}`.
- `click`/`type` targeting a `text`/`heading` landmark -> same retry path with note "Element N is plain text. Use show for text, or pick a button/field."
- `scroll` toward an edge the page is already at -> same retry path (the user would wait forever).
- `type` on a non-textbox/combobox -> accept, log a warning.
- The instruction names a capitalized word that shares nothing with the chosen element's label -> one soft retry.
- `done: true` whose text says sorry / not available / can't -> one retry, never accepted as done.
- HTTP 200 for model-level problems (`ok:false`), 400 malformed request, 500 crashes only.

`POST /transcribe`: body = raw audio bytes (`Content-Type: audio/webm`), max 5 MB. Response `{ ok: true, text: string, latencyMs: number } | { ok: false, error: string }` (`error` is `voice_helper_down`, `voice_timeout`, `audio_too_large`, `audio_empty`, or `whisper_http_<status>`). The backend forwards to the Whisper container (`WHISPER_URL`, default `http://localhost:8790`), 10 s timeout, and never writes audio to disk.

No CORS headers needed for the extension (host permission `http://localhost:8787/*`).

### 6.3 Extension messages

All messages are `{ type: string, ...payload }`.

Content -> Service worker (`chrome.runtime.sendMessage`):

| type | payload | SW response |
|------|---------|-------------|
| `POINTR_START` | `{ goal }` | `{ ok: true }`, starts the loop for `sender.tab.id` (replaces any session in that tab) |
| `POINTR_HELLO` | `{ url }` | `{ session: { goal, status, turn } \| null }` then acts per section 5 |
| `POINTR_STEP_RESULT` | `{ turn, outcome }` | `{ ok: true }` |
| `POINTR_READY` | `{ turn }` | `{ ok: true }` (DOM settled on the same page after an outcome) |
| `POINTR_STOP` | `{}` | `{ ok: true }`, clears session, then sends `POINTR_ENDED` |
| `POINTR_RETRY` | `{}` | `{ ok: true }`, re-enters OBSERVING |
| `POINTR_CHECKIN_ANSWER` | `{ keepGoing: boolean }` | `{ ok: true }` |
| `POINTR_VOICE_TOGGLE` | `{}` | `{ ok: true }` mic button pressed (same as `Alt+X`) |

Service worker -> Content (`chrome.tabs.sendMessage(tabId, ...)`):

| type | payload | Content response |
|------|---------|------------------|
| `POINTR_PREPARE_CAPTURE` | `{ turn }` | Hides ALL Pointr UI (host `visibility:hidden`), waits 2 animation frames, scans, replies `ScanResult`. Stays hidden until `POINTR_THINKING`/`POINTR_STEP`/`POINTR_ERROR`/`POINTR_ENDED`. |
| `POINTR_THINKING` | `{ turn, goal }` | Un-hides UI, widget shows "Looking..." |
| `POINTR_STEP` | `{ turn, step, provisional?: boolean }` | Renders overlay, arms watcher. Replies `{ ok: true }` or `{ ok: false, reason: "element_missing" }` (SW then records `page_changed`). A second `POINTR_STEP` with the same `turn` REPLACES the current one (or, same element and action, only updates the caption). |
| `POINTR_DONE` | `{ message }` | Clears overlay, widget "You did it!" + message for 3 s, then collapses to the launcher |
| `POINTR_ERROR` | `{ message, retryable }` | Un-hides UI, widget error state |
| `POINTR_ENDED` | `{}` | Un-hides UI, clears overlay, widget idle (collapsed) unless the goal box is open |
| `POINTR_CHECKIN` | `{ goal }` | Hides overlay, widget asks "Still want help with: <goal>?" [Keep going] [Stop] |
| `POINTR_TOGGLE_VOICE` | `{}` | From `Alt+X`: open the widget if closed, then behave like the mic button |
| `POINTR_VOICE_STATE` | `{ state: "recording" \| "transcribing" \| "idle" \| "error", text?: string, error?: string }` | Widget mic UI. On `idle` with `text`, fill the box and auto-send (`POINTR_START`) |

```ts
type ScanResult = { scanId: number; page: PageInfo; elements: ElementInfo[] };
```
Content keeps `Map<number, Element>` for the latest scan only; `step.elementId` resolves against it.

Service worker <-> Offscreen document (`chrome.runtime.sendMessage` with `target: "offscreen"`):

| type | payload | reply |
|------|---------|-------|
| `OFFSCREEN_RECORD_START` | `{}` | `{ ok: true } \| { ok: false, error: "mic_denied" \| "no_mic" \| string }` |
| `OFFSCREEN_RECORD_STOP` | `{}` | `{ ok: true, text } \| { ok: false, error }` (offscreen POSTs the audio to `/transcribe` itself) |

## 7. Scanner rules (`content/scanner.js`)

Interactive candidates (document plus every OPEN shadow root, recursively):
`a[href], button, input:not([type=hidden]), select, textarea, summary, [contenteditable=""], [contenteditable="true"], [role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=option], [role=switch], [role=textbox], [role=combobox], [tabindex]:not([tabindex="-1"])`

Keep an element only if ALL are true:
1. Not inside `<pointr-root>`.
2. Rect `width >= 4`, `height >= 4`, intersects the viewport.
3. Computed style visible (`display`, `visibility`, `opacity > 0.05`); not `disabled`; no `aria-hidden="true"` on itself or an ancestor. Exception: a see-through form control (`input`/`select`/`button`, at least 12x12 px, not hidden/file) laid over a VISIBLE wrapper that covers at least half of it is kept (Amazon's "Add to cart"/"Buy Now" are opacity-0 inputs over painted spans; many sites style native selects the same way). Rule 4 still applies.
4. Topmost: `elementFromPoint` at the center of the visible rect (then the 25%/75% points) hits the element or a descendant. Covered elements (behind a modal) are dropped.

Then:
- **De-duplication:** of a nested pair whose rects overlap by more than 85% (of the smaller one), keep the outer element, except that a textbox always wins.
- **Label priority** (trimmed, max 80 chars): `aria-label`, `aria-labelledby` text, `<label for>` or wrapping `<label>`, own inner text, `placeholder`, `title`, first `<img alt>`, `value` of submit/button inputs, `name`.
- **Role:** an allowed explicit `role` attribute wins; else `a` -> link, `button`/`summary` -> button, `input` by type (submit/button/reset -> button, checkbox, radio, else textbox), `select` -> combobox, `textarea`/contenteditable -> textbox, else other.
- **State:** `hasValue` for textbox/combobox only; `checked` for checkbox/radio/switch (and `aria-selected` for tabs); `focused` when it is the active element.
- **Ordering and cap:** document order; above 150 elements the 150 largest are kept, back in document order.

**Text landmarks** (targets for `show` only), collected after interactive elements, max 40, ids continue after the interactive ids:
- `h1`, `h2`, `h3`, `[role=heading]` -> role `heading`.
- "Data-ish" text: an element whose OWN visible text (direct text nodes joined, collapsed whitespace) is 1-60 chars and matches money (`$1,234.56`, `-$12.00`), a percentage, a number with 2+ digits, or a date (`Oct 12`, `10/12/2026`, `September 2026`) -> role `text`. Skip anything inside an interactive candidate, inside a `<label>`, or nested in/around another landmark. SVG `<text>` counts.
- Same visibility + topmost rules. Label = the text itself (max 80 chars). If more than 40, keep those closest to the top of the viewport.
- Plain words without digits (like "Penicillin") are not landmarks: the prompt tells the model to `show` the closest tagged element (open tab, heading, row) instead.
- Landmarks are drawn on the screenshot with a DASHED gray box and gray tag so the model can tell them apart.

## 8. Set-of-Marks drawing (`sw/marks.js`)

1. `captureVisibleTab(windowId, {format:"jpeg", quality:80})`.
2. Decode to `ImageBitmap`; `scale = bitmap.width / page.viewport.width`; output width `W = min(MAX_W, bitmap.width)` where `MAX_W` = 1280 (1024 px was less accurate, 91% vs 97%, and not faster).
3. Draw the bitmap on an `OffscreenCanvas`; per element a 2 px stroke in an 8-color cycle; label tag with a white bold number.
4. **Tag placement:** all boxes are drawn first, then all tags on top. A tag never overlaps another tag, and an OUTSIDE tag keeps 3 px clearance from every other element's box, so it touches only its own box (otherwise a tag next to a neighbour's box is read as the neighbour's number). Boxes at least 28x18 px and tall enough to hold a tag above their text (h >= 2 x tag height) get the tag inside the top-left corner (then inside top-right, bottom-left, then outside). Single-line boxes (buttons, links, table cells) prefer a clear outside spot (left, above-left, above-right, right, below-left) so the tag does not hide the first letters of their text, and fall back to inside. Tiny boxes: outside only. If no spot is clean, the one touching the fewest other boxes wins. Tag color = box color.
5. Encode `image/jpeg` quality 0.8 -> base64 without prefix.

## 9. Overlay spec (`content/overlay.js`)

All tunables live in `content/config.js`; `main.js` turns them into CSS custom properties for the shadow root:

```js
Pointr.config = {
  dim: 0.52,               // page dim alpha outside the ring. 0 disables dimming.
  dimColor: "20,18,56",    // rgb of the dim layer
  ringColor: "#FFD23F",
  ringWidth: 4, ringPad: 7, ringRadius: 12,
  cursorScale: 1.4,        // 34x40 SVG * scale
  cursorNearOpacity: 0.3,  // ghost opacity once the real cursor is near
  nearPx: 60, farPx: 250, farMs: 2000,
  glideMs: 800,
  captionMaxWidth: 330, captionGap: 14,
  completeMs: 400,         // green check flash when the user did the step
};
```

- **Ring:** `border: ringWidth solid ringColor`, radius `ringRadius`, `ringPad` around the element (clamped inside the viewport so its border is never cut off at a screen edge), spotlight via `box-shadow: 0 0 0 9999px rgba(dimColor, dim)` plus a soft yellow glow that pulses until the user's mouse is near. The dim layer never captures clicks (`pointer-events: none`).
- **Ghost cursor:** a yellow arrow SVG with a `#26235C` 2.5 px outline and drop shadow. It glides (`glideMs`, `cubic-bezier(.3,.7,.2,1)`) from where it last pointed (or from the widget's logo on the first step of a page) to 62%/55% into the ring. Solid while gliding; fades to `cursorNearOpacity` when the real cursor is within `nearPx` of the ring; back to solid if the real cursor stays more than `farPx` away for `farMs`. A same-turn replacement (a predicted step replaced by the model's answer) also glides the ring from the old target.
- **Caption:** yellow card, `#26235C` text, bold 19 px Atkinson Hyperlegible, max width 330 px, eyebrow "Step N". Placement candidates: below the ring (and below the cursor's tail), above, right, left; the first that fits and covers neither the ring nor the widget wins, else the first that avoids the ring, else the clamped spot covering the least of it.
- **Tracking:** a `requestAnimationFrame` loop re-reads the target rect so ring, cursor and caption follow scroll and layout shifts.
- **Completion:** the ring turns green with a check badge while the dim lifts (`completeMs`), then fades.
- `info`: no ring or cursor; a centered navy card with the instruction + "I did it". `show`: ring + caption with a "Got it" button (no cursor). `scroll`: no ring; a large animated arrow at the bottom (down) or top (up) edge + caption.
- `prefers-reduced-motion: reduce`: no glide or pulse, fades only.
- **Font:** Atkinson Hyperlegible 400/700 woff2 in `extension/fonts/`. The content script fetches the bytes and adds them to `document.fonts` as `FontFace`s under the family name "Pointr Atkinson Hyperlegible" (an `@font-face` inside a shadow root does not load in Chrome; a `url()` source could be blocked by a strict page CSP; the unique family avoids clashing with a page's own font). Fallback `"Segoe UI", system-ui, sans-serif`.
- **Icons** are built with `createElementNS` (no `innerHTML`, safe under Trusted Types).
- **Widget** (`content/widget.js`): launcher = 56 px navy circle with the yellow cursor logo (a chevron while the goal box is open; hidden during a task). Open: 340 px navy card, white goal textarea with the mic button inside its bottom-right corner, Close + Send (yellow). Thinking and guiding share one 320 px pill ("Looking..." / "Helping you" + the goal, Stop) so it does not jump between turns. Check-in and error: navy card with two buttons. Done: yellow card with a check. Voice: recording = red pulsing mic + "Listening... press Alt+X or the mic to finish" in the box; transcribing = spinner + "Got it, one moment..."; the heard text shows for 300 ms, then it is sent. The widget never covers the current target: if the pill overlaps the target, it moves to the bottom-left corner.

## 10. Watcher rules (`content/watcher.js`)

Armed per step. The first matching rule reports ONE outcome immediately via `POINTR_STEP_RESULT`, clears the overlay, disarms, then waits for the page to settle and sends `POINTR_READY { turn: turn + 1 }` if the page is still alive.

| Step action | Outcome rules |
|-------------|---------------|
| `click` | Capture-phase `click` on `window`: inside the target -> `completed`. Inside a different interactive candidate (same selector list as the scanner) and not Pointr UI -> `clicked_elsewhere`. Clicks on plain text/background are ignored. A `change` event on a select/checkbox/radio target also counts as `completed` (picking a native `<select>` option fires no click). |
| `type` | `focusout` from the target or `Enter` inside it, AND the target has a value -> `completed`. Click on a different interactive candidate -> `clicked_elsewhere`. |
| `scroll` | `scroll` on window or any element (capture) -> debounce 700 ms -> `scrolled`. |
| `info` | "I did it" -> `confirmed`. |
| `show` | "Got it" -> `confirmed`. If `step.done` is true the session ends with "You did it!". |
| all | URL change (poll `location.href` every 500 ms) -> `page_changed`. Target detached, or 0x0 for 400 ms -> `page_changed`. Target covered (topmost check at its center fails) continuously for 400 ms -> `target_covered`. |

- Pointr's own UI never counts (`event.composedPath()` includes the `<pointr-root>` host).
- Wait for settle: `MutationObserver` on `document.body` (subtree, childList, attributes) quiet for 400 ms, max 2.5 s. If the page navigates, the new page's `POINTR_HELLO` takes over.
- Everything (poller, observers, listeners) is torn down on disarm.

## 11. Prompting (`server/prompt.ts`)

The system prompt tells the model:
- Guide a possibly elderly, low-vision, or non-technical user. Exactly ONE next step.
- Only point at numbers from the ELEMENTS list. Never invent a number.
- Never ask for a password; point at the password box ("Type your password here").
- If a popup, promo, cookie banner, or dialog blocks the task, handle it first (usually close it with its X / "No thanks" / "Maybe later"), unless it directly helps the goal.
- `hasValue: true` means the user already typed there; move on. `checked` tells checkbox state and which tab is open.
- **Recovery:** always work toward the ORIGINAL goal from the CURRENT screen. If history shows the user went off-path (logged out, opened another page), guide them back step by step and then continue the goal. Never scold.
- Sign in first when the goal needs an account; the user's own records live in the account menu. Disabled buttons are untagged. A changed control means the last step succeeded.
- Not visible -> `scroll`. Off-page action (phone, email code) -> `info`.
- Goals that ask for information ("what's my balance?", "what are my allergies?"): navigate there, then `show` the landmark that contains the answer, with `done: true` and an instruction that states the answer ("Your checking balance is $2,431.18."). Landmarks are ONLY valid for `show`.
- Goal already achieved on screen -> `done: true`, `action: "info"`, short congratulation.
- Unsure -> `confidence: "low"` and `info`; never point at a random element.
- Instruction style: start with a verb, mention a visual cue (color/position/icon), max ~20 words.
- Also fill `next` with the most likely following step (role + exact expected label) when confident, else null.

Generic notes are added to the user text when they apply (no app-specific logic): `TODAY: <date> (last month was <month>)`; a popup note (a short interactive list with a dismiss button means a popup is open); a repeat note (the same step completed 3x, or 3+ scrolls in a row); a filled-form note (every box filled after the last click -> the on-screen error is stale, click submit); an emptied-fields note (a box HISTORY says was typed in is empty now, e.g. after a reload).

Model config: JSON only; `temperature: 0`; `maxTokens` 300. Gemini: `responseJsonSchema` + low thinking level. Bedrock Nova: Converse API; parse the JSON from the text (strip code fences, take the first `{...}` block), validate with `schema.ts`; one retry on parse failure. The bake-off showed plain-text JSON beats Converse `toolConfig` (97% vs 91%, and slower), and `reasoning` FIRST beats reasoning last (97% vs 91%).

## 12. Speed

### 12.1 Measure
Every turn logs `timings` (settle, scan, capture, marks from the SW) + `modelMs` + `totalMs` (server) into `response.json` and appends one line to `server/logs/timings.csv`: `ts,session,turn,provider,model,settleMs,scanMs,captureMs,marksMs,modelMs,attempt,elements`. `npm run timings` summarizes it.

Typical turn (Nova 2 Lite, p50 / p90): settle 403 / 413 ms, scan 29 / 37, capture 22 / 32, marks 24 / 33, model 1250 / 1493, total 1.7 / 2.0 s. The model is about 70% of a turn.

### 12.2 Cheap settings, bake-off, hedging
- Settings: `temperature 0`, `maxTokens` 300, one-sentence reasoning, 1280 px screenshots.
- `server/scripts/bakeoff.ts` replays every `server/fixtures/*` (request + screenshot + `expected.json {acceptableIds:number[], action, done?, alsoOk?}`) against each candidate `provider:model#knobs` N times and prints accuracy and p50/p90 latency. `server/scripts/make-fixture.ts` turns any log folder into a fixture.
- Hedged requests: if the primary call has not answered after `HEDGE_AFTER_MS` (env, default 1500 = measured p75 of model time, floored), fire an identical second call and use whichever valid answer arrives first; abort the loser. If the only running call fails with a retryable error before the hedge fires, the hedge fires at once. `response.json` logs `hedged` + `winner`. `0` disables.

### 12.3 Predicted next step (instant pointing)
When a step is sent, the SW stores `step.next` in `session.predicted`. On the next turn, right after the scan and capture (never before the capture, so the overlay can never appear in the screenshot) and BEFORE the model call, the SW looks for exactly one scanned element whose role matches and whose normalized label equals the predicted label (case/whitespace-insensitive). If found and the last outcome was `completed`, it immediately sends `POINTR_STEP {turn, step: <predicted as Step with that elementId>, provisional: true}`, then continues the normal model call. When the model answers: same element and action -> keep (update the caption text silently); different -> send a replacing `POINTR_STEP` (the ring glides to the new target). If the user already acted on the provisional step, the model answer is discarded (the turn moved on). A predicted step is on screen about 0.5 s after the user's action. No streaming: output generation is only ~28% of model time and the extension needs the whole JSON anyway. The SW logs `predicted_hit` / `predicted_confirmed` / `predicted_replaced` per turn.

## 13. Voice pipeline

`Alt+X` (manifest command `toggle-voice`, suggested key `Alt+X`) or the mic button inside the goal box:
1. Idle -> the widget opens, the SW ensures the offscreen document exists (`chrome.offscreen.createDocument({reasons:["USER_MEDIA"]})`) and sends `OFFSCREEN_RECORD_START`; the widget shows a red pulsing mic ("Listening... press Alt+X or the mic to finish").
2. Recording -> stop: `OFFSCREEN_RECORD_STOP`; the offscreen document stops `MediaRecorder` (`audio/webm;codecs=opus`), releases the mic, POSTs the blob to `http://localhost:8787/transcribe`, replies `{text}`; the widget shows "Got it, one moment..." then fills the box and auto-sends. A recording under 1.5 KB counts as "nothing said" ("I couldn't hear anything, try again").
3. Guiding -> `Alt+X` stops the current task (`POINTR_STOP`) and starts recording a new goal.
4. Safety cap: auto-stop after 30 s (the SW keeps itself alive while recording). One recording at a time. No silence detection, no wake word.
5. Mic permission: `chrome.runtime.onInstalled` (install) opens `welcome/welcome.html`, which asks for the mic with `getUserMedia` (Chrome prompts once for the extension origin) and shows the current shortcut. If the offscreen document later gets `NotAllowedError`, the SW reopens the welcome tab and the widget says "Please allow the microphone in the new tab."
6. Whisper service: `server/voice/`, Python + `faster-whisper`, model `base.en` (build arg `WHISPER_MODEL`), `compute_type=int8`, `cpu_threads=8`, `beam_size=1`, `vad_filter=True`, `language="en"`, `initial_prompt` with demo vocabulary. The model is downloaded at image build time so it runs offline. Published on `127.0.0.1:8790`. Measured through the backend: p50 835 ms, p90 889 ms for 3.5-6.4 s clips.
7. Friendly errors: "Voice helper isn't running" (Whisper down), "Pointr's helper server is not running" (backend down).

## 14. Verification strategy

- **Backend:** `server/scripts/try-fixture.ts` and `bakeoff.ts` replay fixtures without Chrome. Every real request is logged with the exact marked screenshot the model saw; any failure can become a fixture (`make-fixture.ts`).
- **Robot tester** (`scripts/e2e/`): loads the REAL unpacked extension into Playwright's Chromium (new headless mode) and plays a user who does whatever Pointr points at (real mouse/keyboard input at the center of Pointr's ring, read through the Chrome DevTools Protocol, which can see into the closed shadow root). `suite.mjs` runs every scenario N times and checks "You did it!", step budgets and duplicate side effects (HEROs, popups at 100%, logout mid-task, wrong clicks + check-in, reload, back button, new tab, tab close, "tell me" goals); a failed run saves the extension's own logs. `visual.mjs` screenshots every overlay/widget state, `voice.mjs` tests voice with Chromium's fake microphone, `scanner-cases.mjs` checks the scanner on tricky real-world markup. The robot only drives our own demo apps (or local test pages), never real third-party sites.
- **By hand:** Windows Chrome on the mock apps and on real sites (Outlook, Amazon).
- **Debug:** `DEBUG` const in `content/main.js` draws the scanner's marks on the live page. Content-script logs use the prefix `[Pointr]` (page console); service worker logs use `[Pointr:sw]` (`chrome://extensions` -> Pointr -> "service worker").

## 15. Mock apps contract (details in `docs/MOCK-APPS.md`)

- Hub `http://localhost:3000`, Bank `:3001`, Pharmacy `:3002`, Grocery `:3003`, all from `docker compose up -d --build` in `demo-apps/`.
- `/reset` on every app wipes its state and redirects to `/`.
- Hub API `GET/PUT http://localhost:3000/api/settings` -> `{ popups: { bank, pharmacy, grocery } }` (numbers 0.00-1.00).
- No Pointr hints; semantic HTML; every button/field/icon-button has an accessible name.
- Demo login on all apps: username `eluu`, password `1234`, name Edwin Luu.
