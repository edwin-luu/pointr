# Pointr demo apps

Three fake-but-realistic websites plus a Demo Hub, used to demo Pointr to judges. The
full functional spec lives in `docs/MOCK-APPS.md` at the repo root; this file only
covers how to run things.

## Apps and ports

| App | Port | Personality |
|-----|------|-------------|
| Demo Hub | `3000` | Control panel: open/reset apps, tune popup odds |
| Harbor Bank | `3001` | Cluttered, traditional bank |
| SunPlaza Pharmacy | `3002` | Medium density pharmacy |
| FreshCart | `3003` | Clean, minimal, nested grocery delivery app |

Demo login on all three apps: **username `eluu`, password `1234`** (Edwin Luu).

## Run everything (Docker)

```
cd demo-apps
docker compose up -d --build
```

Then open `http://localhost:3000` (the Hub) in Chrome. Hub settings (popup odds) are
stored in a named Docker volume (`hub-data`) and survive `docker compose restart hub`.

Useful commands:

```
docker compose ps                     # see container status
docker compose logs -f bank           # tail one service's logs
docker compose up -d --build bank     # rebuild + restart just one app
docker compose down                   # stop everything (volume is kept)
docker compose down -v                # stop everything AND wipe hub settings
```

## Local dev (without Docker)

Install once from `demo-apps/`:

```
npm install
```

Then run whichever pieces you're working on. Each Vite app's dev server binds to the
same port the Docker/nginx build uses, so the Hub and the other two apps can still
reach it.

```
npm run dev -w bank        # Vite dev server on :3001
npm run dev -w pharmacy    # :3002
npm run dev -w grocery     # :3003
npm run dev -w hub         # Node serves the Hub directly on :3000
```

If a Docker container is already bound to that port, stop it first
(`docker compose stop bank`, etc).

`npm run build` (no `-w`) type-checks and builds `shared`, `bank`, `pharmacy` and
`grocery` in sequence; `npm run build -w hub` type-checks the Hub server.

## Resetting state

Each app keeps its state (login, cart, balances, orders, prescriptions, appointments)
in `localStorage` under its own prefix (`harbor:`, `sunplaza:`, `freshcart:`). Visiting
`/reset` on any app wipes that app's state and reloads it logged out with seed data
restored. The Hub's **Reset** button does this for you in that app's reused tab, and
**Reset all apps** does all three at once.

## Workspace layout

```
demo-apps/
  shared/      TypeScript helpers shared by the three apps (storage, auth, popups,
               Modal, Toast, ResetRoute, format, demo user) - NOT a shared look/theme
  hub/         Plain Node (node:http) server + a static public/index.html
  bank/        Vite + React + TypeScript
  pharmacy/    Vite + React + TypeScript
  grocery/     Vite + React + TypeScript
  Dockerfile.app     Multi-stage build for bank/pharmacy/grocery (nginx serves dist/)
  hub/Dockerfile     Single-stage build for the Hub (plain node:24-alpine)
  nginx.conf         Shared SPA fallback config for the three React apps
  docker-compose.yml
```

## Notes for anyone testing with the Pointr extension

These apps contain no Pointr-specific hooks (no `data-pointr*`, no special ids). They
use plain semantic HTML with accessible names on every control, exactly like a normal
website, so Pointr should be able to read them the same way it would read a real site.
