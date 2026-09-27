globalThis.Pointr = globalThis.Pointr || {};

(function () {
  if (Pointr.initialized) return;
  Pointr.initialized = true;

  const DEBUG = false;
  Pointr.debug = DEBUG;

  const HELLO_QUIET_MS = 500;
  const HELLO_MAX_MS = 4000;
  const SETTLE_QUIET_MS = 400; // was 600 (about 30% of a turn); robot-suite verified
  const SETTLE_MAX_MS = 2500;

  function log(...args) {
    console.log("[Pointr]", ...args);
  }

  // chrome.runtime.sendMessage that never throws (the extension may have been
  // reloaded under this page: "Extension context invalidated").
  Pointr.send = function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            log("send failed:", message.type, chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(response);
        });
      } catch (err) {
        log("send failed:", message.type, String(err));
        resolve(null);
      }
    });
  };

  // content/config.js -> CSS custom properties for styles.js.
  function configVars() {
    const c = Pointr.config;
    const hex = c.ringColor.replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
    return `:host {
      --p-dim: ${c.dim}; --p-dim-rgb: ${c.dimColor};
      --p-ring: ${c.ringColor}; --p-ring-rgb: ${rgb};
      --p-ring-w: ${c.ringWidth}px; --p-ring-r: ${c.ringRadius}px;
      --p-cursor-near: ${c.cursorNearOpacity}; --p-glide: ${c.glideMs}ms;
      --p-cap-w: ${c.captionMaxWidth}px;
    }\n`;
  }

  // Atkinson Hyperlegible for Pointr's UI. An @font-face inside a shadow root
  // does not load in Chrome, so the faces are added to the document's font
  // set under a Pointr-only family name. The bytes are fetched by the content
  // script (not a url() the page's CSP could block); on any failure the
  // fallback fonts in styles.js are used.
  function loadFonts() {
    const FAMILY = "Pointr Atkinson Hyperlegible";
    for (const weight of ["400", "700"]) {
      fetch(chrome.runtime.getURL(`fonts/atkinson-hyperlegible-${weight}.woff2`))
        .then((r) => r.arrayBuffer())
        .then((buf) => new FontFace(FAMILY, buf, { weight, style: "normal" }).load())
        .then((face) => document.fonts.add(face))
        .catch((err) => log("font not loaded:", weight, String(err)));
    }
  }

  function createShadowHost() {
    const host = document.createElement("pointr-root");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "closed" });
    const styleEl = document.createElement("style");
    styleEl.textContent = configVars() + Pointr.css;
    shadow.appendChild(styleEl);

    Pointr.host = host;
    Pointr.shadow = shadow;
  }

  // Two animation frames so the hide is painted before the SW captures. rAF
  // does not run in a hidden tab, so a timeout guarantees we never hang.
  function raf2() {
    return new Promise((resolve) => {
      const fallback = setTimeout(resolve, 150);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          clearTimeout(fallback);
          resolve();
        })
      );
    });
  }

  const ui = {
    async hideForCapture() {
      Pointr.host.style.visibility = "hidden";
      await raf2();
    },
    show() {
      Pointr.host.style.visibility = "visible";
    },
  };
  Pointr.ui = ui;

  let lastScanResult = null;
  // The step the overlay + watcher are showing: { turn, step }. A second
  // POINTR_STEP for the same turn (predicted step, then the model's answer)
  // either confirms it or replaces it.
  let current = null;
  // Turn whose outcome was already reported (reset by each new capture): a
  // late POINTR_STEP for it (the model answering a predicted step the user
  // already acted on) must not be shown again.
  let outcomeTurn = null;
  // Bumped whenever the loop moves on (new step, end, error, check-in), so a
  // settle that finishes late does not send a stale POINTR_READY.
  let epoch = 0;

  // done: the user did the step -> the ring flashes green before it goes.
  function resetGuidance(done) {
    epoch += 1;
    current = null;
    Pointr.watcher.disarm();
    if (done) Pointr.overlay.complete();
    else Pointr.overlay.clear();
  }

  // Watcher reported the user's response: tell the SW immediately, clear the
  // overlay (feels responsive), then wait for the DOM to settle and send READY.
  async function onOutcome(turn, outcome) {
    const step = current && current.turn === turn ? current.step : null;
    outcomeTurn = turn;
    log(`t${turn} outcome: ${outcome}`);
    Pointr.send({ type: "POINTR_STEP_RESULT", turn, outcome });
    resetGuidance(outcome === "completed" || outcome === "confirmed");
    // "Got it" on the answer to a question ends the session: no next turn.
    if (step && step.done && step.action === "show" && outcome === "confirmed") {
      Pointr.widget.setState("done", { message: step.instruction });
      return;
    }
    const myEpoch = epoch;
    Pointr.widget.setState("thinking");
    const settle = await Pointr.dom.waitForSettle({ quietMs: SETTLE_QUIET_MS, maxMs: SETTLE_MAX_MS });
    if (epoch !== myEpoch) return;
    log(`t${turn} settled in ${settle.ms} ms${settle.quiet ? "" : " (max wait)"}`);
    Pointr.send({ type: "POINTR_READY", turn: turn + 1 });
  }

  function handleMessage(message, sender, sendResponse) {
    if (message.type !== "POINTR_PREPARE_CAPTURE") log("received", message.type, message);

    switch (message.type) {
      case "POINTR_PREPARE_CAPTURE": {
        outcomeTurn = null;
        (async () => {
          resetGuidance();
          // Stay hidden until POINTR_THINKING/ERROR/ENDED: the SW captures the
          // marked screenshot after this reply, and no Pointr UI may be in it.
          await ui.hideForCapture();
          try {
            lastScanResult = Pointr.scanner.scan();
            sendResponse(lastScanResult);
          } catch (err) {
            console.error("[Pointr] scan failed", err);
            sendResponse({ error: String(err) });
          }
        })();
        return true; // async response
      }

      case "POINTR_THINKING": {
        ui.show();
        if (Pointr.debug && lastScanResult) Pointr.scanner.debugDraw(lastScanResult);
        Pointr.widget.setState("thinking", { goal: message.goal });
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_STEP": {
        const { step, turn } = message;
        if (turn === outcomeTurn) {
          sendResponse({ ok: true }); // already acted on; the SW moves on by itself
          return false;
        }
        const needsElement = step.action === "click" || step.action === "type" || step.action === "show";
        const element = step.elementId != null ? Pointr.scanner.getElement(step.elementId) : null;
        // The page moved on since the scan (SPA route change or re-render):
        // the step no longer matches what the user sees.
        const stale =
          !lastScanResult ||
          lastScanResult.page.url !== location.href ||
          (needsElement && (!element || !element.isConnected));
        if (stale) {
          sendResponse({ ok: false, reason: "element_missing" });
          return false;
        }

        // Same turn, same target and action: the model confirmed the
        // predicted step. Keep the ring and the armed watcher; only the
        // caption text may change.
        if (
          current && current.turn === turn && Pointr.watcher.isArmed() &&
          current.step.elementId === step.elementId && current.step.action === step.action
        ) {
          current.step = step;
          Pointr.overlay.updateCaption(step);
          sendResponse({ ok: true });
          return false;
        }

        // A same-turn step replacing the one on screen: the ring glides over.
        const replace = !!current && current.turn === turn;
        resetGuidance();
        ui.show();
        Pointr.widget.setState("guiding");
        Pointr.overlay.showStep(step, element, turn, { replace });
        current = { turn, step };
        Pointr.watcher.arm(step, element, (outcome) => onOutcome(turn, outcome));
        if (message.provisional) log(`t${turn} showing the predicted step early`);
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_DONE": {
        resetGuidance();
        ui.show();
        Pointr.widget.setState("done", { message: message.message });
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_ERROR": {
        // Also restores the UI if this arrives while hidden for a capture.
        resetGuidance();
        ui.show();
        Pointr.widget.setState("error", { message: message.message, retryable: message.retryable });
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_ENDED": {
        resetGuidance();
        ui.show();
        // Only collapse a session widget: after Alt+X during guidance the
        // goal box is already open and recording a new goal.
        if (Pointr.widget.inSession()) Pointr.widget.setState("idle");
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_CHECKIN": {
        resetGuidance();
        ui.show();
        Pointr.widget.setState("checkin", { goal: message.goal });
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_TOGGLE_VOICE": {
        Pointr.voice.toggle();
        sendResponse({ ok: true });
        return false;
      }

      case "POINTR_VOICE_STATE": {
        Pointr.voice.onState(message);
        sendResponse({ ok: true });
        return false;
      }

      default:
        log("unhandled message type:", message.type);
        return false;
    }
  }

  // POINTR_HELLO once the page is loaded and quiet, so the SW can resume a
  // session across page loads. The widget restores itself from the reply.
  async function hello() {
    const deadline = performance.now() + HELLO_MAX_MS;
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((r) => window.addEventListener("load", r, { once: true }));
    await Promise.race([loaded, new Promise((r) => setTimeout(r, HELLO_MAX_MS))]);
    const left = Math.max(0, deadline - performance.now());
    if (left > 0) await Pointr.dom.waitForSettle({ quietMs: HELLO_QUIET_MS, maxMs: left });

    const reply = await Pointr.send({ type: "POINTR_HELLO", url: location.href });
    const session = reply && reply.session;
    if (!session) return;
    log(`restoring session (${session.status}, t${session.turn})`);
    if (session.status === "checkin") Pointr.widget.setState("checkin", { goal: session.goal });
    else Pointr.widget.setState("thinking", { goal: session.goal });
  }

  loadFonts();
  createShadowHost();
  Pointr.widget.init();
  chrome.runtime.onMessage.addListener(handleMessage);
  log("content script ready on", location.href);
  hello();
})();
