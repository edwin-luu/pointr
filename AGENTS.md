# Pointr - Agent Instructions

Pointr is a Chrome extension + small local Node backend that guides users through web tasks with an on-screen ghost cursor, a dimmed-page highlight ring, and short captions. Users give one goal by typing or by voice (`Alt+X`). Demoed on three local mock apps (bank, pharmacy, grocery) plus a Demo Hub, and tested by hand on real sites (Outlook, Amazon).

## Read first

1. `README.md` - what Pointr is, how to run and test it.
2. `docs/ARCHITECTURE.md` - decisions, components, exact data contracts. Treat section 6 (contracts) as law; code comments refer to its section numbers.
3. `docs/MOCK-APPS.md` when a change touches the demo apps.
4. `notes/` (local only, gitignored; may not exist in a fresh clone): `PROGRESS.md` (build log, numbers, known issues, open ideas), `milestones/STRETCH.md` (next features), `TEST-CHECKLIST.md` (manual paths through the demo apps), `LIVE-DEMO.md`.

## Working rules

- Do not change a contract in `docs/ARCHITECTURE.md` section 6 (message types, request/response shapes, step schema) or the default/fallback model (D2) without asking the user first. If a change is approved, update ARCHITECTURE.md in the same change.
- **Never run git commands** (no add/commit/push/branch). The user commits manually; suggest a commit message instead.
- Never use em-dashes in any file or message. Use a plain dash "-".
- The user cares about pixel-level visual quality for anything UI.
- If something unrelated looks broken or risky, tell the user immediately and propose a fix.
- After a change: run `node scripts/e2e/suite.mjs --smoke` (about 1 minute); the full suite (`--runs 3`) only for big changes. Keep `notes/PROGRESS.md` truthful if it exists.

## Debugging rules

- Reproduce first, as close to the real user flow as possible: the robot tester in `scripts/e2e/` runs the real unpacked extension in Chromium; Windows Chrome via the user when that matters. The robot must never drive real third-party sites (use a local page served through Playwright routing, like `scripts/e2e/scanner-cases.mjs`).
- The backend logs every request to `server/logs/<timestamp>-<session>-<turn>/` with the marked screenshot the model saw, the request (minus image), the prompt, and the response (with timings). When a step picks the wrong element, open the latest log folder and LOOK at `screenshot.jpg` before guessing. `server/logs/timings.csv` has one line per turn.
- A failed robot run saves the extension's own logs to `scripts/e2e/.out/fail-*.log`.
- Content-script logs use the prefix `[Pointr]` in the page's DevTools console. Service worker logs (`[Pointr:sw]`) are under `chrome://extensions` -> Pointr -> "service worker".

## Environment facts

- Windows 11 host, code in WSL2 Ubuntu (`Ubuntu-26.04`) at `/home/eluu/pointr`. No GPU. Docker Engine + Compose run natively in WSL.
- Chrome runs on Windows. The extension is loaded unpacked from `\\wsl.localhost\Ubuntu-26.04\home\eluu\pointr\extension`. After extension changes the user clicks reload in `chrome://extensions` and refreshes the page.
- Node 24 runs `.ts` files directly (type stripping). Only erasable TS syntax: no `enum`, no `namespace`, no constructor parameter properties. Relative imports must include the `.ts` extension. (The Vite apps in `demo-apps/` are normal TS and are exempt.)
- Ports: backend `8787` (`cd server && npm run dev`), Whisper `8790` (`cd server && docker compose up -d whisper`), Demo Hub `3000`, Bank `3001`, Pharmacy `3002`, Grocery `3003` (`cd demo-apps && docker compose up -d --build`). All reachable from Windows Chrome via WSL2 localhost forwarding.
- Secrets live only in `server/.env` (gitignored): `AWS_BEARER_TOKEN_BEDROCK` (12-hour Bedrock key, regenerate before demos), `GEMINI_API_KEY`. Never print, log, or commit them, and never put them in the extension.
- Server edits: restart `npm run dev` by hand after editing `server/*.ts` or `server/.env` (`node --watch` silently loses track of files saved by replacement). To stop it from a shell use `pkill -f "[n]ode --watch"` (the bracket stops pkill from matching your own shell).
- Model switch: `MODEL_PROVIDER=bedrock` (default, Nova 2 Lite via `BEDROCK_MODEL`) or `gemini` in `server/.env` (one commented line to swap).
