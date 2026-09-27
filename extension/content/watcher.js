globalThis.Pointr = globalThis.Pointr || {};

// DOM helpers shared by the watcher and main.js.
(function () {
  // Resolves once document.body has had no mutations (subtree, childList,
  // attributes) for `quietMs`, or after `maxMs` at the latest.
  // Resolves to { quiet: boolean, ms: number }.
  function waitForSettle({ quietMs = 600, maxMs = 3000 } = {}) {
    return new Promise((resolve) => {
      const start = performance.now();
      const root = document.body || document.documentElement;
      let quietTimer = null;
      let maxTimer = null;
      let observer = null;

      function finish(quiet) {
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        if (observer) observer.disconnect();
        resolve({ quiet, ms: Math.round(performance.now() - start) });
      }

      function restartQuiet() {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => finish(true), quietMs);
      }

      observer = new MutationObserver(restartQuiet);
      observer.observe(root, { subtree: true, childList: true, attributes: true });
      maxTimer = setTimeout(() => finish(false), maxMs);
      restartQuiet();
    });
  }

  Pointr.dom = { waitForSettle };
})();

// Watches for the user's response to ONE step (ARCHITECTURE section 10) and
// reports exactly one StepOutcome through the onOutcome callback.
(function () {
  const COVER_MS = 400; // target covered this long -> target_covered
  const HIDDEN_MS = 400; // target hidden (0x0) this long -> page_changed
  const SCROLL_DEBOUNCE_MS = 700;
  const TICK_MS = 100; // cover/detach checks
  const URL_POLL_MS = 500;

  let active = null; // { cleanups: Function[], report: Function }

  function isPointrEvent(event) {
    return !!Pointr.host && event.composedPath().includes(Pointr.host);
  }

  // The nearest interactive candidate (same selector as the scanner) on the
  // event's path, or null for plain text/background.
  function interactiveOnPath(event) {
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.matches(Pointr.scanner.CANDIDATE_SELECTOR)) return node;
    }
    return null;
  }

  function hasValue(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return el.value.length > 0;
    if (tag === "select") return !!el.value;
    if (el.isContentEditable) return (el.innerText || "").trim().length > 0;
    return false;
  }

  function isToggleOrSelect(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return true;
    if (tag === "input") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      return type === "checkbox" || type === "radio";
    }
    return false;
  }

  // Topmost check at the center of the target's visible part, skipping
  // Pointr's own UI. Off-screen or zero-size targets are never "covered".
  function isCovered(el) {
    const r = el.getBoundingClientRect();
    const left = Math.max(r.left, 0);
    const right = Math.min(r.right, window.innerWidth);
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, window.innerHeight);
    if (right - left < 1 || bottom - top < 1) return false;
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    const root = el.getRootNode();
    const ctx = root instanceof ShadowRoot && root.elementsFromPoint ? root : document;
    const hit = ctx.elementsFromPoint(x, y).find((n) => n !== Pointr.host);
    return !(hit && Pointr.scanner.isDescendantOrSelf(el, hit));
  }

  function isHidden(el) {
    const r = el.getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    active.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function disarm() {
    if (!active) return;
    for (const fn of active.cleanups) fn();
    active = null;
  }

  // step: the Step; element: resolved target (null for scroll/info);
  // onOutcome(outcome): called once, after the watcher has disarmed itself.
  function arm(step, element, onOutcome) {
    disarm();
    active = { cleanups: [], report: null };
    const me = active;

    function report(outcome) {
      if (active !== me) return;
      disarm();
      onOutcome(outcome);
    }
    me.report = report;

    const action = step.action;

    if (action === "click" && element) {
      listen(window, "click", (e) => {
        if (isPointrEvent(e)) return;
        if (e.composedPath().includes(element)) return report("completed");
        if (interactiveOnPath(e)) report("clicked_elsewhere");
        // plain text/background clicks are ignored
      }, true);
    }

    if (action === "type" && element) {
      const doneIfValue = () => {
        if (hasValue(element)) report("completed");
      };
      listen(window, "focusout", (e) => {
        if (e.composedPath().includes(element)) doneIfValue();
      }, true);
      listen(window, "keydown", (e) => {
        if (e.key === "Enter" && e.composedPath().includes(element)) doneIfValue();
      }, true);
      listen(window, "click", (e) => {
        if (isPointrEvent(e)) return;
        if (e.composedPath().includes(element)) return;
        if (interactiveOnPath(e)) report("clicked_elsewhere");
      }, true);
    }

    // Choosing an option in a native <select> fires no click, and a
    // checkbox/radio can change via its label: the change IS the action.
    if ((action === "click" || action === "type") && element && isToggleOrSelect(element)) {
      listen(window, "change", (e) => {
        if (e.composedPath().includes(element)) report("completed");
      }, true);
    }

    if (action === "scroll") {
      let timer = null;
      listen(window, "scroll", () => {
        clearTimeout(timer);
        timer = setTimeout(() => report("scrolled"), SCROLL_DEBOUNCE_MS);
      }, { capture: true, passive: true });
      me.cleanups.push(() => clearTimeout(timer));
    }

    // info / show: the overlay's "I did it" / "Got it" button calls confirmInfo().

    // All actions: URL change, detached/hidden target, covered target.
    const startUrl = location.href;
    let coveredSince = 0;
    let hiddenSince = 0;
    let lastUrlCheck = performance.now();
    const ticker = setInterval(() => {
      const now = performance.now();
      if (now - lastUrlCheck >= URL_POLL_MS) {
        lastUrlCheck = now;
        if (location.href !== startUrl) return report("page_changed");
      }
      if (!element) return;
      if (!element.isConnected) return report("page_changed");

      if (isHidden(element)) {
        hiddenSince = hiddenSince || now;
        if (now - hiddenSince >= HIDDEN_MS) return report("page_changed");
      } else {
        hiddenSince = 0;
      }

      if (isCovered(element)) {
        coveredSince = coveredSince || now;
        if (now - coveredSince >= COVER_MS) return report("target_covered");
      } else {
        coveredSince = 0;
      }
    }, TICK_MS);
    me.cleanups.push(() => clearInterval(ticker));
  }

  function confirmInfo() {
    if (active) active.report("confirmed");
  }

  Pointr.watcher = { arm, disarm, confirmInfo, isArmed: () => !!active };
})();
