globalThis.Pointr = globalThis.Pointr || {};

// CSS for the closed shadow root. Look follows pointer-demo.html (ARCHITECTURE 9).
// The numbers a user may want to tune live in content/config.js; main.js turns
// them into the --p-* custom properties used below.
Pointr.css = `
:host {
  all: initial;
  --p-panel: #26235C;
  --p-panel-2: #343078;
  --p-ink: #F6F5FF;
  --p-muted: #C8C5F0;
  --p-beam: #FFD23F;
  --p-beam-hover: #FFDB5C;
  --p-beam-ink: #26235C;
  --p-field-ink: #1D1B45;
  --p-red: #E0475B;
  --p-green: #1FA85A;
  --p-font: "Pointr Atkinson Hyperlegible", "Segoe UI", system-ui, -apple-system, sans-serif;
  --p-ease: cubic-bezier(.3, .7, .2, 1);
}

* { box-sizing: border-box; font-family: var(--p-font); -webkit-font-smoothing: antialiased; }
button { font: inherit; margin: 0; }
svg { display: block; }

/* =====================================================================
   Overlay: ring + dim, ghost cursor, caption, info card, scroll arrow
   ===================================================================== */

.pointr-box {
  position: fixed;
  left: 0;
  top: 0;
  border: var(--p-ring-w) solid var(--p-ring);
  border-radius: var(--p-ring-r);
  box-shadow: 0 0 0 9999px rgba(var(--p-dim-rgb), 0);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
  will-change: transform;
  transition: opacity .3s ease, box-shadow .35s ease, border-color .15s ease;
}
.pointr-box.pointr-on {
  opacity: 1;
  box-shadow: 0 0 0 9999px rgba(var(--p-dim-rgb), var(--p-dim));
}
.pointr-box::after {
  content: "";
  position: absolute;
  inset: calc(-1 * var(--p-ring-w));
  border-radius: inherit;
  box-shadow: 0 0 0 8px rgba(var(--p-ring-rgb), .35);
  transition: box-shadow .15s ease;
}
.pointr-box.pointr-pulse::after { animation: pointr-pulse 1.4s ease-in-out infinite; }
@keyframes pointr-pulse {
  50% { box-shadow: 0 0 0 16px rgba(var(--p-ring-rgb), .12); }
}
.pointr-box.pointr-gliding {
  transition: transform var(--p-glide) var(--p-ease), width var(--p-glide) var(--p-ease),
    height var(--p-glide) var(--p-ease), opacity .3s ease, box-shadow .35s ease;
}

/* Done: the ring turns green with a check, the dim lifts, then it all fades. */
.pointr-box.pointr-complete {
  border-color: var(--p-green);
  box-shadow: 0 0 0 9999px rgba(var(--p-dim-rgb), 0);
}
.pointr-box.pointr-complete::after { animation: none; box-shadow: 0 0 0 8px rgba(31, 168, 90, .3); }
.pointr-box.pointr-leaving { opacity: 0; transition: opacity .15s ease, box-shadow .2s ease; }
.pointr-check {
  position: absolute;
  top: -15px;
  right: -15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--p-green);
  box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(0, 0, 0, .25);
  display: grid;
  place-items: center;
  animation: pointr-pop .3s cubic-bezier(.3, 1.6, .5, 1);
}
@keyframes pointr-pop { from { transform: scale(0); } }

.pointr-cursor {
  position: fixed;
  left: 0;
  top: 0;
  width: 34px;
  height: 40px;
  transform-origin: 0 0;
  opacity: 0;
  pointer-events: none;
  z-index: 3;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, .35));
  will-change: transform, opacity;
  transition: opacity .3s ease;
}
.pointr-cursor.pointr-on { opacity: 1; }
.pointr-cursor.pointr-near { opacity: var(--p-cursor-near); }
.pointr-cursor.pointr-gliding { transition: transform var(--p-glide) var(--p-ease), opacity .3s ease; }

.pointr-caption {
  position: fixed;
  left: 0;
  top: 0;
  max-width: var(--p-cap-w);
  background: var(--p-beam);
  color: var(--p-beam-ink);
  border-radius: 12px;
  padding: 11px 16px 13px;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.32;
  box-shadow: 0 8px 24px rgba(20, 18, 56, .28), 0 1px 2px rgba(20, 18, 56, .2);
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  transition: opacity .3s ease;
}
.pointr-caption.pointr-on { opacity: 1; }
.pointr-caption.pointr-leaving { opacity: 0; transition: opacity .15s ease; }
.pointr-caption.pointr-has-btn { pointer-events: auto; }
.pointr-caption-text { display: block; overflow-wrap: anywhere; }
.pointr-eyebrow {
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: .09em;
  text-transform: uppercase;
  opacity: .72;
  margin-bottom: 3px;
}
.pointr-caption .pointr-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  background: var(--p-beam-ink);
  border-color: var(--p-beam-ink);
  color: var(--p-ink);
}
.pointr-caption .pointr-btn:hover { background: var(--p-panel-2); border-color: var(--p-panel-2); }
.pointr-caption .pointr-btn:focus-visible { outline: 3px solid var(--p-beam-ink); outline-offset: 2px; }

.pointr-card {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(400px, calc(100vw - 32px));
  background: var(--p-panel);
  color: var(--p-ink);
  border-radius: 16px;
  padding: 20px 22px 22px;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.38;
  pointer-events: auto;
  z-index: 3;
  box-shadow: 0 20px 60px rgba(20, 18, 56, .45), 0 2px 8px rgba(20, 18, 56, .25);
  animation: pointr-card-in .25s ease-out;
}
.pointr-card .pointr-eyebrow { color: var(--p-beam); opacity: 1; margin-bottom: 6px; }
.pointr-card .pointr-btn { display: block; width: 100%; margin-top: 18px; }
@keyframes pointr-card-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); } }

.pointr-arrow {
  position: fixed;
  left: 50%;
  width: 64px;
  height: 64px;
  margin-left: -32px;
  border-radius: 50%;
  background: var(--p-beam);
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 2;
  box-shadow: 0 8px 24px rgba(20, 18, 56, .3), 0 0 0 6px rgba(var(--p-ring-rgb), .3);
  animation: pointr-bob 1.1s ease-in-out infinite;
}
.pointr-arrow.pointr-down { bottom: 28px; }
.pointr-arrow.pointr-up { top: 28px; animation-direction: reverse; }
@keyframes pointr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }

/* =====================================================================
   Widget: launcher + card / pill
   ===================================================================== */

.pointr-dock {
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  z-index: 5;
}
.pointr-dock.pointr-left { right: auto; left: 24px; align-items: flex-start; }

.pointr-launcher {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--p-panel);
  border: none;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 0 0 2px rgba(246, 245, 255, .9), 0 6px 18px rgba(20, 18, 56, .4);
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.pointr-launcher:hover { background: var(--p-panel-2); transform: translateY(-1px); }
.pointr-launcher:active { transform: translateY(0); }
.pointr-launcher:focus-visible { outline: 3px solid var(--p-beam); outline-offset: 4px; }
.pointr-launcher[hidden] { display: none; }
.pointr-launcher .pointr-logo { transform: translate(2px, 1px); }

.pointr-panel {
  width: 340px;
  background: var(--p-panel);
  color: var(--p-ink);
  border-radius: 16px;
  padding: 16px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 16px;
  line-height: 1.4;
  box-shadow: 0 16px 48px rgba(20, 18, 56, .38), 0 2px 6px rgba(20, 18, 56, .22);
  animation: pointr-rise .2s ease-out;
}
.pointr-panel[hidden] { display: none; }
@keyframes pointr-rise { from { opacity: 0; transform: translateY(8px); } }

.pointr-head { display: flex; align-items: center; gap: 9px; min-height: 24px; }
.pointr-title { font-size: 18px; font-weight: 700; letter-spacing: -.005em; }

.pointr-field { position: relative; }
.pointr-panel textarea {
  display: block;
  width: 100%;
  min-height: 108px;
  resize: none;
  margin: 0;
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 11px 13px 50px;
  background: #fff;
  color: var(--p-field-ink);
  font-family: var(--p-font);
  font-size: 17px;
  line-height: 1.4;
  transition: border-color .15s ease;
}
.pointr-panel textarea::placeholder { color: #6E6A9E; opacity: 1; }
.pointr-panel textarea:focus { outline: none; border-color: var(--p-beam); }
.pointr-panel textarea[readonly] { cursor: default; }

.pointr-mic {
  position: absolute;
  right: 9px;
  bottom: 9px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--p-panel);
  color: var(--p-ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background .15s ease;
}
.pointr-mic:hover { background: var(--p-panel-2); }
.pointr-mic:focus-visible { outline: 3px solid var(--p-panel); outline-offset: 2px; }
.pointr-mic.pointr-live { background: var(--p-red); animation: pointr-mic-pulse 1.3s ease-out infinite; }
.pointr-mic.pointr-live:hover { background: #C93A4D; }
.pointr-mic.pointr-busy { cursor: default; }
.pointr-mic.pointr-busy:hover { background: var(--p-panel); }
@keyframes pointr-mic-pulse {
  0% { box-shadow: 0 0 0 0 rgba(224, 71, 91, .55); }
  100% { box-shadow: 0 0 0 12px rgba(224, 71, 91, 0); }
}

.pointr-note { margin-top: -4px; font-size: 15px; color: var(--p-muted); }
.pointr-note.pointr-bad { color: #FFB8C2; }

.pointr-row { display: flex; gap: 10px; }
.pointr-btn {
  flex: 1;
  min-height: 44px;
  border-radius: 12px;
  padding: 9px 14px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  border: 2px solid rgba(200, 197, 240, .45);
  background: transparent;
  color: var(--p-ink);
  transition: background .15s ease, border-color .15s ease;
}
.pointr-btn:hover { background: rgba(246, 245, 255, .08); border-color: rgba(200, 197, 240, .7); }
.pointr-btn:focus-visible { outline: 3px solid var(--p-beam); outline-offset: 2px; }
.pointr-btn.pointr-primary { background: var(--p-beam); border-color: var(--p-beam); color: var(--p-beam-ink); }
.pointr-btn.pointr-primary:hover { background: var(--p-beam-hover); border-color: var(--p-beam-hover); }

.pointr-msg { font-size: 17px; }
.pointr-msg strong { color: var(--p-beam); font-weight: 700; }

/* thinking + guiding: a compact pill that stays the same size between turns */
.pointr-panel[data-state="thinking"],
.pointr-panel[data-state="guiding"] {
  width: 320px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 10px 12px;
}
.pointr-badge {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--p-panel-2);
  display: grid;
  place-items: center;
}
.pointr-badge .pointr-logo { transform: translate(1.5px, .5px); }
.pointr-pill-text { flex: 1; min-width: 0; }
.pointr-pill-eyebrow {
  display: block;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--p-muted);
}
.pointr-pill-goal {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.pointr-btn.pointr-small { flex: none; min-height: 38px; padding: 6px 14px; font-size: 15px; border-radius: 10px; }

.pointr-spin {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 3px solid rgba(255, 210, 63, .22);
  border-top-color: var(--p-beam);
  animation: pointr-rot .8s linear infinite;
}
.pointr-mic .pointr-spin { width: 18px; height: 18px; border-width: 2.5px; border-color: rgba(246, 245, 255, .25); border-top-color: var(--p-ink); }
@keyframes pointr-rot { to { transform: rotate(360deg); } }

.pointr-dots::after {
  content: "";
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: pointr-dots 1.2s steps(4, end) infinite;
}
@keyframes pointr-dots {
  0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75%, 100% { content: "..."; }
}

/* done: a yellow card with a check, like pointer-demo's win box */
.pointr-panel[data-state="done"] {
  background: var(--p-beam);
  color: var(--p-beam-ink);
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 20px 20px 22px;
}
.pointr-win-mark {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--p-panel);
  display: grid;
  place-items: center;
  margin-bottom: 6px;
  animation: pointr-pop .5s cubic-bezier(.3, 1.6, .5, 1);
}
.pointr-big { font-size: 22px; font-weight: 700; line-height: 1.25; }
.pointr-panel[data-state="done"] .pointr-msg { font-size: 17px; font-weight: 700; opacity: .85; overflow-wrap: anywhere; }

/* error: the message next to a small alert mark */
.pointr-alert { display: flex; gap: 12px; align-items: flex-start; }
.pointr-alert-mark {
  flex: none;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--p-red);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .pointr-box::after, .pointr-arrow, .pointr-dots::after, .pointr-spin, .pointr-mic.pointr-live,
  .pointr-panel, .pointr-card, .pointr-check, .pointr-win-mark { animation: none !important; }
  .pointr-dots::after { content: "..."; }
}

.pointr-debug-tag {
  position: fixed;
  background: #111827;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 1;
}

.pointr-debug-box {
  position: fixed;
  border: 2px solid #ef4444;
  pointer-events: none;
  z-index: 1;
}
`;
