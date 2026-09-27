# Pointr

**A patient pointer for the web.** Tell Pointr one goal, typed or spoken ("pay my credit card bill"), and it shows you where to click, one step at a time, on the real website: the page dims, a big yellow cursor glides to the right button, a ring highlights it, and a short caption says what to do. You do the clicking; Pointr looks again after every action until the goal is done.

Built at ShellHacks for people who find websites hard to use: older adults, people with low vision, anyone who freezes at a screen full of buttons. It is not a chatbot. There is no chat window, just one goal box and a pointer.

## What it does

- **One goal, step by step.** Pointr plans a single next step at a time from what is on the screen right now, and never clicks or types for you (it never asks for your password either; it points at the box).
- **Handles real-world mess.** Closes popups and promos first, guides you back after a wrong click, a logout, a reload or the Back button, follows you into new tabs, and after three off-path clicks asks "Still want help with ...?".
- **Answers "tell me" goals.** "What's my checking balance?" navigates there and rings the answer.
- **Push-to-talk voice.** Press **Alt+X** (or the mic in the goal box), talk, press again. The microphone is allowed once for Pointr, never per website, and speech is transcribed on your own machine.
- **Works on real sites.** Demoed on three mock apps we built, and tested by hand on Outlook (sign in, draft an email) and Amazon (add a product to the cart).

## How it works

```
 Chrome                                                 Local machine
+-----------------------------------------+           +--------------------------------------+
| Content script (every page)             |           | Backend  server/  (Node 24, :8787)   |
|  scanner  -> numbered element list      |           |   POST /next-step -> prompt ->       |
|  overlay  -> ring, dim, cursor, caption |           |     Amazon Bedrock Nova 2 Lite       |
|  watcher  -> "the user did it"          |           |     (Gemini automatic fallback)      |
|  widget   -> goal box, mic, Stop        |   HTTP    |   POST /transcribe -> Whisper        |
| Service worker: step loop               | <-------> |   logs/ (every request + screenshot) |
|  screenshot + numbered boxes            |           |                                      |
|  (Set-of-Marks), predicted next step    |           | Whisper  server/voice/ (Docker :8790)|
| Offscreen document: mic (Alt+X)         |           |   faster-whisper base.en, CPU        |
+-----------------------------------------+           |                                      |
                                                      | Demo apps  demo-apps/ (Docker)       |
                                                      |   Hub :3000  Bank :3001              |
                                                      |   Pharmacy :3002  Grocery :3003      |
                                                      +--------------------------------------+
```

Each step: the extension screenshots the tab with a number drawn on every button, link and field, and sends the picture plus the numbered list to the model. The model answers with ONE element number and a short instruction; the extension rings that element (pixel-exact, from the real page) and waits for the user. Pointr only looks again when something happens, and it often predicts the next step, so the next ring can appear about half a second after you act. Details and contracts: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Run it

Requirements: Node 24, Docker with Compose, Google Chrome, and an Amazon Bedrock API key (and/or a Gemini API key).

1. **Keys.** Copy `server/.env.example` to `server/.env` and fill in `AWS_BEARER_TOKEN_BEDROCK` and/or `GEMINI_API_KEY`. `.env` is gitignored; never commit it.
2. **Backend.** `cd server && npm install && npm run dev`. The startup line shows the model, the fallback, and when the Bedrock key expires; the next line says whether the voice helper is reachable.
3. **Voice helper.** `cd server && docker compose up -d --build whisper` (the first build downloads the speech model; after that it runs offline).
4. **Demo apps.** `cd demo-apps && docker compose up -d --build`, then open the Demo Hub at `http://localhost:3000`.
5. **Extension.** In Chrome open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension/` folder. A welcome tab opens: click **Allow microphone** once. After code changes, click reload on Pointr and refresh the page.

Demo login on every mock app: username **`eluu`**, password **`1234`**.

**Use it:** click the round Pointr button (bottom right) and type a goal, or press **Alt+X**, say the goal, and press **Alt+X** again. Try "pay my credit card bill" on the bank, "refill my blood pressure medicine" on the pharmacy, or "order milk, eggs and bread for pickup" on the grocery store.

To make Gemini the main model: in `server/.env` comment out `MODEL_PROVIDER=bedrock`, uncomment `MODEL_PROVIDER=gemini`, and restart the backend.

Running Chrome on Windows with the code in WSL works too: load the extension from `\\wsl.localhost\<distro>\<path>\extension`; WSL forwards the localhost ports.

## Test it

- **Robot tester** (`scripts/e2e/`): loads the real extension into Playwright's Chromium and plays a user who clicks wherever Pointr's ring is. Set up once with `bash scripts/e2e/setup.sh`, then `cd scripts/e2e && node suite.mjs --smoke` (about 1 minute) or `node suite.mjs --runs 3` (all 19 scenarios: the three main tasks, popups, logout mid-task, wrong clicks, reload, Back, new tab, tab close, "tell me" questions). One goal: `node run-goal.mjs http://localhost:3001 "pay my credit card bill"`.
- **Voice**, with Chromium's fake microphone: `node voice.mjs`. **Look**, screenshots of every overlay and widget state: `node visual.mjs [--zoom 1.25]`. **Scanner** on tricky real-world markup: `node scanner-cases.mjs`.
- **Model bake-off**: `cd server && npm run bakeoff` replays 41 captured screens against the model and reports accuracy and latency.

The robot only drives our own demo apps and local test pages, never real third-party sites.

## Repository

```
extension/     Chrome extension (Manifest V3, plain JS, no build step)
server/        Node backend, model providers, prompt, fixtures, Whisper container (voice/)
demo-apps/     Demo Hub + Harbor Bank + SunPlaza Pharmacy + FreshCart (React, Docker)
scripts/e2e/   Robot tester
docs/          ARCHITECTURE.md (design + contracts), MOCK-APPS.md (what the demo apps do)
```

## Built with

Chrome Extensions (Manifest V3, offscreen documents), Amazon Bedrock (Nova 2 Lite), Google Gemini API, faster-whisper, Node.js 24, React + Vite, Docker, Playwright.

Font: Atkinson Hyperlegible by the Braille Institute (SIL Open Font License, `extension/fonts/OFL.txt`).
