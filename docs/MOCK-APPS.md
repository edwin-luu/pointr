# Pointr demo apps - specification

Three fake-but-realistic web apps + a Demo Hub, used to demo Pointr to ShellHacks judges. Pointr (the Chrome extension) must treat them like any real website, so these apps must look and behave like real sites and contain NOTHING made for Pointr.

This file is the reference for what each app does and which tasks it supports.

## 1. Ground rules (contract with the Pointr extension)

1. **No Pointr hints.** No `data-pointr*`, no ids/classes/text that exist to help Pointr. `data-testid` is also not needed; do not add it.
2. **Semantic, well-labeled HTML**, like a well-built real site: real `<button>` for actions, `<a href>` for navigation, `<label for>` on every field, `aria-label` on every icon-only button ("Open cart", "Close", "Account menu", "Add Whole Milk, 1 gal to cart"), `role="dialog" aria-modal="true" aria-labelledby` on modals. Accessible names are how Pointr reads the page, exactly like a screen reader.
3. **Realistic look and density** (see each app's "personality"). Not a wireframe. Real brand feel, real copy, fake names only (no real company names or logos).
4. **Fully offline assets.** No CDN, no Google Fonts link, no remote images. Fonts via `@fontsource/*` npm packages or system fonts; images as inline SVG, CSS art, or emoji.
5. **Routing with real paths** (React Router `BrowserRouter`), so the URL changes on navigation like a modern site. nginx serves `index.html` for unknown paths so deep links and `/reset` work on reload.
6. **State in `localStorage`** under one prefix per app (`harbor:`, `sunplaza:`, `freshcart:`). Survives reloads. `/reset` removes every key with that prefix plus `sessionStorage`, then `location.replace("/")`.
7. **Not-in-demo links:** most nav/footer links exist for realism. Links/buttons for features that are not built show a small toast "This part of the site isn't available in the demo." and do not navigate. Nothing may ever show a blank page or crash.
8. **Pointr widget space:** Pointr puts a small launcher in the bottom-right corner (about 80x80 px, bigger when open). Do not put an app's ONLY way to do something in a fixed bottom-right floating element. (Normal page content scrolling under that corner is fine.)
9. **Viewport:** must look right from 1024 to 1920 px wide at 100% and 125% zoom (Windows Chrome). Mobile layouts are not needed but nothing should overflow horizontally at 1024 px.
10. **Deterministic data** (hardcoded seeds below). Only popups are random.

Demo user on all three apps: **username `eluu`, password `1234`, name Edwin Luu** (first name Edwin). Email `edwin.luu@example.com`, phone `(305) 555-0147`, address `742 Palm Ave, Apt 3, Miami, FL 33135`. Wrong credentials show an inline error "Your username or password is incorrect." (no lockout).

## 2. Tech stack and layout

```
demo-apps/
  package.json              npm workspaces: shared, hub, bank, pharmacy, grocery
  docker-compose.yml        services hub:3000, bank:3001, pharmacy:3002, grocery:3003
  Dockerfile.app            multi-stage: node:24-alpine build (ARG APP) -> nginx:alpine serve dist
  nginx.conf                SPA fallback: try_files $uri $uri/ /index.html
  shared/                   TS + React helpers used by all three apps (NOT a shared look)
    src/storage.ts          prefixed localStorage helpers + resetApp(prefix)
    src/auth.tsx            AuthProvider, useAuth, RequireAuth (redirects to /login?next=<path>)
    src/popups.ts           getPopupChance(app), rollPopup(app)
    src/Modal.tsx           accessible dialog with backdrop + X (aria-label "Close")
    src/Toast.tsx           toast system + notInDemo() helper
    src/ResetRoute.tsx      the /reset route component
    src/format.ts           money, date formatting
    src/demoUser.ts         DEMO_USER constant
  hub/                      Node 24 server (TS run directly) + static public/index.html (no React needed)
  bank/  pharmacy/  grocery/   Vite + React + TypeScript apps, each with its OWN CSS + brand
```

- Vite + React 19 + TypeScript + React Router 7 (or current stable). Plain CSS files with CSS variables per app (no Tailwind needed; a team member may edit styles by hand).
- `docker compose up -d --build` from `demo-apps/` starts everything; hub data (settings JSON) lives in a named volume so it survives restarts.
- Ports are published on all interfaces so Windows Chrome reaches them via WSL2 localhost forwarding (same as the Pointr backend on 8787).
- Optional dev loop: `npm run dev -w bank` etc. with Vite on the same port (stop that compose service first).

## 3. Demo Hub (`http://localhost:3000`)

Purpose: one tab to drive the demo. Pointr is never needed here.

Server (`hub/server.ts`, `node:http`):
- `GET /` -> `public/index.html` (plain HTML/CSS/JS, clean, matches the Pointr palette: navy `#26235C`, yellow `#FFD23F`).
- `GET /api/settings` -> `{ "popups": { "bank": 0.33, "pharmacy": 0.40, "grocery": 0.20 }, "defaults": { same } }`
- `PUT /api/settings` body `{ "popups": { ... } }` -> validates each is a number 0..1 (round to 2 decimals), saves to `/data/settings.json`, returns the new settings. 400 on bad input.
- CORS on `/api/*`: `Access-Control-Allow-Origin: *`, methods `GET, PUT, OPTIONS`, header `Content-Type` (apps on other ports call it).

UI: title "Pointr Demo Hub", three cards (Harbor Bank :3001, SunPlaza Pharmacy :3002, FreshCart :3003). Each card:
- Online/offline dot (ping the app every 5 s with `fetch(url, {mode:"no-cors"})`).
- **Open** -> `window.open("http://localhost:300X/", "pointr-<app>")`. **Reset** -> `window.open("http://localhost:300X/reset", "pointr-<app>")`. The named target reuses the same tab.
- Popup chance: label with what it is ("'Go paperless?' dialog after each login"), a slider 0.00-1.00 step 0.01, a number box (2 decimals) kept in sync, and quick buttons **Never (0)**, **Default**, **Always (1)**. Saves on change (debounced 300 ms) with a small "Saved" confirmation.
- Footer row: **Reset all** (opens all three `/reset` URLs in their named tabs) and the login reminder "Demo login: eluu / 1234".

## 4. Popups (random interruptions)

`rollPopup(app)` fetches `http://localhost:3000/api/settings` (800 ms timeout, no cache) at the moment of the roll, falls back to the app's built-in default if the hub is unreachable, and returns `Math.random() < chance`. `1.00` = always, `0.00` = never.

| App | Popup | Rolled when | Default | Content |
|-----|-------|-------------|---------|---------|
| Bank | "Go paperless?" modal | each successful login, shown on the page the login lands on | 0.33 | Leaf icon, "Go paperless with Harbor Bank", short text, buttons **Go paperless** (sets paperless on, toast "You're now paperless.") and **Maybe later**, plus X (aria-label "Close"). Backdrop blocks the page. |
| Grocery | "50% off your first delivery" promo | each search results page load (each new query) | 0.20 | Appears 3 s after results render. Big colorful promo card with code `FRESH50`, a **Shop deals** button (shows toast) and a SMALL X in the corner (aria-label "Close promotion"). Backdrop blocks the page. |
| Pharmacy | "Your order is ready for pickup" | each home page (`/`) load | 0.40 | "Good news, Edwin! Order #SP-20418 is ready for pickup at SunPlaza, W Flagler St." Buttons **View order** (goes to `/pharmacy/orders`, login required) and **Dismiss**, plus X (aria-label "Close"). Backdrop blocks the page. |

All three use the shared accessible `Modal`. Focus moves into the dialog; Escape closes it.

## 5. Harbor Bank (`:3001`) - "cluttered"

Personality: a big traditional bank. Navy `#0B2545` + gold `#E0A526` accents, white cards, dense content. Everything is visible but buried in noise: 7-link top nav, utility bar ("Locations", "Contact us", "Espanol" (toast), search icon), promo carousel, rate tables, many similar buttons, huge footer.

### Pages
- `/` (public home): utility bar, main nav (Personal, Business, Loans, Mortgages, Investing, Learn, Help), **sign-in card on the left of the hero** (Username, Password, "Remember me" checkbox, **Sign in** button, "Forgot username or password?" toast, "Enroll" toast), promo carousel (auto-rotates every 6 s, pause button), 4 product tiles, rates table, "Why Harbor" section, footer with ~30 links. Header also has a **Sign in** button linking to `/login`.
- `/login`: dedicated sign-in page (same fields). After success go to `next` query param or `/accounts`.
- `/accounts` (auth): "Good afternoon, Edwin" header, **Log out** in the header on every signed-in page, account tiles:
  - Everyday Checking ••4821: available **$2,431.18**
  - Harbor Savings ••7730: **$8,905.42**
  - Harbor Rewards Visa ••1956: current balance **$642.37**, statement balance **$518.20**, minimum due **$35.00**, due **Oct 12, 2026**, credit limit $5,000.00
  - Quick actions row with deliberately similar buttons: **Transfer**, **Pay Entity** (opens `/pay-bills`), **Pay card**, **Deposit check** (toast), **Send money** (toast), **Statements**
  - Recent activity (last 8 transactions across accounts), right sidebar promos ("You're pre-approved for a personal loan", "Refer a friend").
- `/accounts/checking`, `/accounts/savings`, `/accounts/card`: balance header + transaction table (date, description, category, amount, running balance) with a search box and a month filter.
- `/pay-card` (auth), 3 steps on separate routes or a stepper:
  1. **Payment details**: card preselected (Harbor Rewards Visa ••1956). Amount radios: Statement balance $518.20 / Minimum due $35.00 / Current balance $642.37 / **Other amount** (radio reveals a `$` text field labeled "Other amount"). **Pay from** select starting on "Choose an account" (Everyday Checking ••4821 $2,431.18 / Harbor Savings ••7730 $8,905.42). Payment date: "Today" radio (default) or "Pick a date" (date input). **Continue**. Validation errors inline: no account chosen; other amount empty, <= 0, > current balance, or > the chosen account's available balance.
  2. **Review**: summary + **Submit payment** + Back/Edit.
  3. **Confirmation**: check icon, "Payment scheduled", confirmation number `HB-` + 6 random digits, amount, account. Balances update: checking/savings minus amount; card current balance minus amount; statement balance becomes $0.00 if paid >= statement balance. New transactions appear in both accounts' activity.
- `/pay-bills` (auth): payee list (Sunshine Electric, Bay Water Utility, Metro Internet, City of Miami Parking), each with **Pay** -> amount + from-account + Continue -> Review -> Confirm (same pattern, updates balances). "Add a payee" toast.
- `/transfer` (auth): from/to selects (checking/savings), amount, Continue -> Review -> Confirm; balances update.
- `/spending` (auth): "Spending insights". Month select (July 2026, August 2026, **September 2026 (month to date)** default). Bar or donut chart by category (pure SVG/CSS) + table: category, amount, % of total, number of transactions. Clicking a category row shows its transactions. Seed values that tests check: **August 2026 Groceries $412.56**, September 2026 (to date) Groceries $287.14. Categories: Groceries, Dining, Gas, Utilities, Shopping, Health, Entertainment, Transportation.
- `/statements` (auth): list of monthly statements (PDF links -> toast).
- `/help` (public): help center with an FAQ search, FAQ accordion (8 questions), **Contact us** section: phone `1-800-555-0142` (Mon-Fri 8am-8pm, Sat 9am-2pm), **Send a secure message** (auth-gated link to `/messages/new`), "Find a branch" (static list of 3 Miami branches with addresses and hours).
- `/messages/new` (auth): topic select (Card question, Payment issue, Account question, Other), subject, message textarea, **Send message** -> confirmation "We'll reply within 1 business day." and the message appears in `/messages` (inbox list, auth).
- `/profile` (auth): contact info (read-only) + Paperless statements toggle.
- Any auth page while logged out -> `/login?next=<path>`; after login you land back on it (this powers the "logged out mid-payment" recovery demo).

### Seed data
Generate ~30 transactions per month for July, August, September 2026 across checking and card with the categories above, consistent with the balances and the two checked grocery totals. Merchant names are fake but realistic ("Palma Supermarket", "Aisle 8 Market", "Sunshine Electric", "Metro Gas #214", "Cafe Cubano Express").

### Supported tasks (must all work end to end)
1. **HERO:** Pay the credit card bill (statement balance, minimum, current, or a **custom amount**) from checking or savings, starting logged out.
2. Check the checking balance (starts logged out; answer is on `/accounts`).
3. How much did I spend on groceries last month? (`/spending`, August 2026 -> $412.56).
4. Contact customer service: find the phone number, or send a secure message.
5. Pay a bill (e.g. the electric bill) to a payee.
6. Transfer money between checking and savings.
7. Turn on paperless statements.
8. Log out / log back in.

## 6. SunPlaza Pharmacy (`:3002`) - "medium"

Personality: the pharmacy from `pointer-demo.html` grown into a full site. Reuse its palette and feel: teal `#0D6A62`, light teal `#E3F2EF`, orange dot logo `#FFB547`, `#F7FBFA` background, promo strip. Moderately busy.

### Pages
- `/` home: nav (Home, **Pharmacy**, Health services, Shop, Photo, Store locator, **Sign in** / "Hi, Edwin" account menu with Sign out), promo strip ("Free flu shots this week..."), hero, product tiles, "order ready" popup roll.
- `/login`: sign-in page; `next` param support.
- `/pharmacy`: cards **Refill a prescription**, Transfer a prescription (toast), Talk to a pharmacist (shows phone + hours), **Order history**, Vaccines (toast).
- `/pharmacy/refills` (auth): prescription list (checkbox per Rx, each shows name, what it's for, refills left, last filled):
  - **Lisinopril 10 mg** - for **high blood pressure** - 3 refills left - last filled Aug 28, 2026 - refillable
  - **Levothyroxine 50 mcg** - for thyroid - 2 refills left - refillable
  - **Metformin 500 mg** - for blood sugar - 0 refills left - checkbox disabled, **Request renewal from Dr. Alvarez** button (-> "Renewal request sent" state)
  - **Atorvastatin 20 mg** - for cholesterol - filled Sep 20, 2026 - checkbox disabled, "Too early to refill. Available Oct 15."
  - **Continue** (disabled until at least one checked).
- `/pharmacy/refills/review` (auth): selected items, **Pickup store** select (SunPlaza W Flagler St / Coral Way / Bird Road), **Pickup time** select (Tomorrow after 2 PM / Tomorrow after 5 PM / Monday after 10 AM), **Place refill order** + Back.
- `/pharmacy/refills/done`: confirmation "Refill ordered", order number `SP-` + 5 digits, pickup details. Order appears in history; Lisinopril refills left decrements.
- `/pharmacy/orders` (auth): order history with statuses (seed: #SP-20418 Levothyroxine "Ready for pickup", #SP-19877 "Picked up").
- `/care` (Health services): cards **Book an appointment**, Vaccines (toast), Lab tests (toast).
- `/care/appointments/new` (auth), stepper:
  1. **Choose a provider**: **Dr. Maria Alvarez, MD - Family medicine - "Your primary care doctor"** badge; Dr. James Chen, MD - Internal medicine; Kim Patel, NP - Nurse practitioner.
  2. **Visit type**: Annual checkup, Follow-up visit, Sick visit; **In person** or **Video visit**.
  3. **Pick a date and time**: calendar grid for the next 14 days starting Monday Sep 28, 2026 (weekends disabled), time slot buttons per day (morning/afternoon, some "Unavailable").
  4. **Review**: optional "Reason for visit" textarea, **Book appointment**.
  Confirmation page; appointment shows in `/care/appointments` (upcoming list with Reschedule (toast) / **Cancel** (confirm dialog)).
- `/account/health` (auth) "My health record" tabs or sections:
  - **Allergies**: Penicillin (hives), Sulfa drugs (rash)
  - **Lab results**: A1C **6.1%** (Aug 14, 2026), LDL cholesterol **118 mg/dL** (Aug 14, 2026), Blood pressure **128/82** (Sep 3, 2026)
  - **Immunizations**: Flu (Oct 2025), COVID-19 booster (Sep 2025), Tdap (Mar 2021)
  - **Medications**: the 4 prescriptions above
  - **Care team**: Dr. Maria Alvarez (primary care), phone (305) 555-0110
- Account menu (signed in): My health record, Prescriptions, Appointments, Order history, Sign out.

### Supported tasks
1. **HERO:** Refill my blood pressure medicine (Lisinopril) for pickup, starting logged out.
2. Book an appointment with my primary doctor (Dr. Alvarez).
3. What are my allergies? / What was my last A1C? / Show my lab results.
4. Check whether my order is ready (order history).
5. Request a renewal for Metformin.
6. Cancel an upcoming appointment.
7. Sign out / sign back in.

## 7. FreshCart (`:3003`) - "clean but nested"

Personality: a modern minimalist grocery delivery app. White, lots of space, green `#1F8A4C` accents, rounded cards. The difficulty is NESTING and ICON-ONLY controls, not clutter: key actions hide behind a hamburger menu, an account icon, a cart icon, and a multi-step checkout.

### Pages
- Header on every page: hamburger button (aria-label "Open menu") -> slide-out menu with aisles + Orders + Help; logo; store pill "Shopping at **Aisle 8 Market** - Coral Way" (click -> store picker modal: Aisle 8 Market - Coral Way, Palma Supermarket - Flagler, GreenLeaf Organics - Brickell; same catalog, store name carries into checkout); centered search field (label "Search products"); account icon button (aria-label "Account"); cart icon button with count badge (aria-label "Cart, N items").
- `/` home: minimal hero "Groceries from your neighborhood store", 3 horizontal product rows (Fresh picks, Breakfast basics, Deals).
- `/search?q=...`: results grid; each card: illustration (inline SVG/emoji), name, size, price, icon-only **+** button (aria-label "Add <name> to cart") that turns into a - qty + stepper. Several look-alike products per search (see catalog). Promo popup roll.
- `/aisle/:slug` (from hamburger menu): Produce, Dairy & Eggs, Bakery, Meat & Seafood, Pantry, Frozen, Beverages, Snacks.
- `/product/:id`: detail page with bigger image, description, **Add to cart** + qty.
- Cart: the cart icon opens a right-side drawer: items with steppers + remove, subtotal, and a **Checkout** button placed directly under the subtotal near the TOP of the drawer (not bottom-right, see ground rule 8). Empty state text.
- `/checkout` requires sign-in: if signed out, go to `/signin?next=/checkout` (sign-in page with "Continue as guest" disabled/toast). Multi-step on one route with a stepper:
  1. **How do you want your order?** segmented control **Delivery** (DEFAULT selected) / **Pickup**. Continue.
  2. Delivery: saved address (742 Palm Ave...) with "Change" (toast), delivery window buttons (Today 4-5 PM, 5-6 PM, 6-7 PM, Tomorrow 9-10 AM, 10-11 AM), driver tip (15% default, 10/15/20%, Custom). Pickup: store shown (from the store pill), pickup window buttons (Today 3-4 PM, 4-5 PM, 5-6 PM, Tomorrow 10-11 AM). Continue.
  3. **Payment**: saved card "Visa ending 1956" preselected, "Add a card" (toast). Continue.
  4. **Review**: items, fees (Delivery fee $3.99 + service fee $2.49 for delivery; pickup free), tax 7%, total, **Place order**.
  Confirmation `/orders/:id` with order number `FC-` + 6 digits, "Pickup at ..." or "Delivery to ..." and window. Cart clears. Order appears in `/orders`.
- `/orders` (auth, via hamburger or account menu): order history.
- Account menu (icon): Signed in as Edwin / Sign in, Orders, Addresses (toast), Sign out.

### Catalog (at least 48 products across the 8 aisles, with deliberate look-alikes)
- Milk: Whole Milk 1 gal $4.29, 2% Reduced Fat Milk 1 gal $4.19, Organic Whole Milk half gal $5.49, Lactose-Free 2% Milk half gal $4.79, Unsweetened Almond Milk half gal $3.99
- Eggs: Large White Eggs 12 ct $3.49, Large Brown Eggs 12 ct $4.29, Organic Free-Range Eggs 12 ct $5.99, Large White Eggs 18 ct $4.99
- Bread: White Sandwich Bread 20 oz $2.99, 100% Whole Wheat Bread 20 oz $3.49, Sourdough Loaf $4.99, Cuban Bread $2.49
- plus produce, meat, pantry, frozen, beverages, snacks items with realistic prices.
Search matches name and aisle words case-insensitively ("milk" returns all milk + almond milk; "eggs" returns all eggs).

### Supported tasks
1. **HERO:** Order milk, eggs and bread for pickup (search, add 3 items, cart, checkout, sign in, switch to Pickup, pick a window, place order).
2. Same order for delivery with a delivery window and tip.
3. Browse an aisle from the menu and add an item.
4. Change the store.
5. Remove an item / change a quantity in the cart.
6. Check my past orders.
7. Sign in / sign out.
