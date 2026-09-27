globalThis.Pointr = globalThis.Pointr || {};

// The overlay (ARCHITECTURE section 9, look from pointer-demo.html):
// click/type -> ring + dim + ghost cursor + caption; show -> ring + caption
// with "Got it"; info -> centered card with "I did it"; scroll -> arrow +
// caption. All numbers come from content/config.js.
(function () {
  const MARGIN = 12; // caption <-> viewport edge
  const CURSOR_W = 34, CURSOR_H = 40, CURSOR_TIP = 2; // arrow tip at (2,2) in the SVG
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let nodes = []; // the current step's nodes
  let leaving = []; // nodes of a finished step still fading out
  let leaveTimers = [];
  let cleanups = []; // listeners/timers of the current step
  let rafId = 0;
  let relayout = null; // forces the current ring/caption to be placed again
  let pointing = null; // { box, cursor, cap } while a ring is shown
  let lastRing = null; // ring rect of the step on screen (replace -> glide from here)
  let lastCursor = null; // where the ghost cursor last pointed (next glide starts here)

  const cfg = () => Pointr.config;

  function add(el) {
    Pointr.shadow.appendChild(el);
    nodes.push(el);
    return el;
  }

  function div(className) {
    const el = document.createElement("div");
    el.className = className;
    return el;
  }

  function stopTracking() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    relayout = null;
    for (const fn of cleanups) fn();
    cleanups = [];
  }

  function dropLeaving() {
    for (const t of leaveTimers) clearTimeout(t);
    leaveTimers = [];
    for (const n of leaving) n.remove();
    leaving = [];
  }

  function clear() {
    stopTracking();
    dropLeaving();
    for (const n of nodes) n.remove();
    nodes = [];
    pointing = null;
    lastRing = null;
    if (Pointr.widget) Pointr.widget.avoid(null);
  }

  // The user did the step: the ring flashes green with a check while the dim
  // lifts, then everything fades. Steps without a ring just go away.
  function complete() {
    if (!pointing) return clear();
    const { box, cursor, cap } = pointing;
    stopTracking();
    dropLeaving();
    leaving = nodes;
    nodes = [];
    pointing = null;
    lastRing = null;
    if (Pointr.widget) Pointr.widget.avoid(null);

    box.classList.remove("pointr-pulse", "pointr-gliding");
    box.classList.add("pointr-complete");
    const check = div("pointr-check");
    check.append(Pointr.icons.check(16, "#fff", 3));
    box.append(check);
    if (cursor) cursor.classList.remove("pointr-on", "pointr-near");
    if (cap) cap.classList.add("pointr-leaving");
    leaveTimers.push(setTimeout(() => box.classList.add("pointr-leaving"), cfg().completeMs));
    leaveTimers.push(setTimeout(dropLeaving, cfg().completeMs + 200));
  }

  // Forces a style flush so the next class change animates from here.
  function flush(el) {
    void el.getBoundingClientRect();
  }

  function caption(step, turn) {
    const el = div("pointr-caption");
    const eyebrow = document.createElement("span");
    eyebrow.className = "pointr-eyebrow";
    eyebrow.textContent = step.action === "show" ? "Here it is" : `Step ${turn}`;
    const text = document.createElement("span");
    text.className = "pointr-caption-text";
    text.textContent = step.instruction;
    el.append(eyebrow, text);
    // "show" points at information: nothing to click on the page, so the
    // caption carries the button that says the user has seen it.
    if (step.action === "show") {
      el.classList.add("pointr-has-btn");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pointr-btn";
      btn.textContent = "Got it";
      btn.addEventListener("click", () => Pointr.watcher.confirmInfo());
      el.append(btn);
    }
    return el;
  }

  function overlapArea(a, b) {
    if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  // Caption spot: below the ring (and below the ghost cursor's tail), else
  // above, else right, else left; clamped to the viewport. A spot must never
  // cover the target; it should not cover the widget either.
  function placeCaption(el, ring, cursorBox) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = cfg().captionGap;
    const clampX = (x) => Math.max(MARGIN, Math.min(x, vw - MARGIN - w));
    const clampY = (y) => Math.max(MARGIN, Math.min(y, vh - MARGIN - h));
    const belowTop = Math.max(ring.bottom + gap, cursorBox ? cursorBox.bottom + 6 : 0);
    const rightLeft = Math.max(ring.right + gap, cursorBox ? cursorBox.right + 6 : 0);
    const candidates = [
      { left: clampX(ring.left), top: belowTop, fits: belowTop + h <= vh - MARGIN },
      { left: clampX(ring.left), top: ring.top - gap - h, fits: ring.top - gap - h >= MARGIN },
      { left: rightLeft, top: clampY(ring.top), fits: rightLeft + w <= vw - MARGIN },
      { left: ring.left - gap - w, top: clampY(ring.top), fits: ring.left - gap - w >= MARGIN },
    ];
    const dock = Pointr.widget ? Pointr.widget.rect() : null;
    const rectOf = (c) => ({ left: c.left, top: c.top, right: c.left + w, bottom: c.top + h });
    const fitting = candidates.filter((c) => c.fits);
    let best =
      fitting.find((c) => !overlapArea(rectOf(c), ring) && !overlapArea(rectOf(c), dock)) ||
      fitting.find((c) => !overlapArea(rectOf(c), ring));
    if (!best) {
      // Nothing clean (a huge target): the clamped spot covering the least of it.
      best = candidates
        .map((c) => ({ left: clampX(c.left), top: clampY(c.top) }))
        .sort((a, b) => overlapArea(rectOf(a), ring) - overlapArea(rectOf(b), ring))[0];
    }
    el.style.transform = `translate(${Math.round(best.left)}px, ${Math.round(best.top)}px)`;
  }

  // The element's rect plus ringPad, kept inside the viewport so the ring's
  // border is never cut off at a screen edge (a link in a top bar).
  function ringRect(r) {
    const pad = cfg().ringPad;
    const edge = (lo, v, hi) => (v >= lo && v <= hi ? v : Math.max(lo, Math.min(v, hi)));
    const inX = r.right > 0 && r.left < window.innerWidth;
    const inY = r.bottom > 0 && r.top < window.innerHeight;
    return {
      left: inX ? edge(0, r.left - pad, r.left) : r.left - pad,
      top: inY ? edge(0, r.top - pad, r.top) : r.top - pad,
      right: inX ? edge(r.right, r.right + pad, window.innerWidth) : r.right + pad,
      bottom: inY ? edge(r.bottom, r.bottom + pad, window.innerHeight) : r.bottom + pad,
    };
  }

  function setBox(box, ring) {
    box.style.transform = `translate(${Math.round(ring.left)}px, ${Math.round(ring.top)}px)`;
    box.style.width = `${Math.round(ring.right - ring.left)}px`;
    box.style.height = `${Math.round(ring.bottom - ring.top)}px`;
  }

  // The ghost cursor's tip sits 62% across and 55% down the ring (pointer-demo).
  function cursorPoint(ring) {
    return {
      x: ring.left + (ring.right - ring.left) * 0.62,
      y: ring.top + (ring.bottom - ring.top) * 0.55,
    };
  }

  function setCursor(cursor, p) {
    const s = cfg().cursorScale;
    cursor.style.transform = `translate(${p.x - CURSOR_TIP * s}px, ${p.y - CURSOR_TIP * s}px) scale(${s})`;
  }

  function cursorBoxAt(p) {
    const s = cfg().cursorScale;
    return { left: p.x, top: p.y, right: p.x + (CURSOR_W - CURSOR_TIP) * s, bottom: p.y + (CURSOR_H - CURSOR_TIP) * s };
  }

  function distanceToRect(x, y, r) {
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    return Math.hypot(dx, dy);
  }

  // Ghost fades (and the pulse stops) once the real mouse is near the ring;
  // both come back after the mouse has been far away for farMs.
  function trackProximity(box, cursor, getRing, isGliding) {
    let near = false;
    let farTimer = 0;
    const apply = () => {
      if (cursor) cursor.classList.toggle("pointr-near", near && !isGliding());
      box.classList.toggle("pointr-pulse", !near && !reducedMotion.matches);
    };
    const onMove = (e) => {
      const ring = getRing();
      if (!ring) return;
      const d = distanceToRect(e.clientX, e.clientY, ring);
      if (d <= cfg().nearPx) {
        clearTimeout(farTimer);
        farTimer = 0;
        if (!near) { near = true; apply(); }
      } else if (d > cfg().farPx) {
        if (near && !farTimer) farTimer = setTimeout(() => { farTimer = 0; near = false; apply(); }, cfg().farMs);
      } else {
        clearTimeout(farTimer); // in between: keep whatever it is now
        farTimer = 0;
      }
    };
    window.addEventListener("mousemove", onMove, { capture: true, passive: true });
    cleanups.push(() => {
      window.removeEventListener("mousemove", onMove, { capture: true, passive: true });
      clearTimeout(farTimer);
    });
    apply();
    return apply;
  }

  // opts.replace: the same turn's earlier step (a predicted step the model
  // replaced) was on screen; the ring glides from it to the new target.
  function showPointing(step, element, turn, opts) {
    const glide = !reducedMotion.matches;
    const from = opts.replace ? opts.fromRing : null;
    const withCursor = step.action !== "show"; // "show" needs no cursor (ARCHITECTURE 9)

    const box = add(div("pointr-box"));
    const cap = add(caption(step, turn));
    const cursor = withCursor ? add(Pointr.icons.cursor("pointr-cursor")) : null;
    pointing = { box, cursor, cap };

    const target = ringRect(element.getBoundingClientRect());
    let gliding = false;

    // Start positions.
    if (from && glide) {
      setBox(box, from);
      box.classList.add("pointr-on");
    } else {
      setBox(box, target);
    }
    if (cursor) {
      const start = glide ? lastCursor || (Pointr.widget && Pointr.widget.anchor()) : null;
      setCursor(cursor, start || cursorPoint(target));
    }
    flush(box);

    // Animate to the target: the frame loop below sets the end positions.
    if (glide && (from || cursor)) {
      gliding = true;
      if (from) box.classList.add("pointr-gliding");
      if (cursor) cursor.classList.add("pointr-gliding");
      const t = setTimeout(() => {
        gliding = false;
        for (const n of [box, cursor]) if (n) n.classList.remove("pointr-gliding");
        applyProximity();
      }, cfg().glideMs + 30);
      cleanups.push(() => clearTimeout(t));
    }
    box.classList.add("pointr-on");
    cap.classList.add("pointr-on");
    if (cursor) cursor.classList.add("pointr-on");

    let ring = null;
    const applyProximity = trackProximity(box, cursor, () => ring, () => gliding);

    let last = "";
    relayout = () => (last = "");
    const frame = () => {
      rafId = requestAnimationFrame(frame);
      if (!element.isConnected) return;
      const r = element.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}|${window.innerWidth}|${window.innerHeight}`;
      if (key === last) return;
      last = key;
      ring = ringRect(r);
      lastRing = ring;
      setBox(box, ring);
      let cursorBox = null;
      if (cursor) {
        const p = cursorPoint(ring);
        lastCursor = p;
        setCursor(cursor, p);
        cursorBox = cursorBoxAt(p);
      }
      placeCaption(cap, ring, cursorBox);
      if (Pointr.widget) Pointr.widget.avoid(ring);
    };
    frame();
  }

  function showInfo(step, turn) {
    const card = add(div("pointr-card"));
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    const eyebrow = document.createElement("span");
    eyebrow.className = "pointr-eyebrow";
    eyebrow.textContent = `Step ${turn}`;
    const text = document.createElement("div");
    text.textContent = step.instruction;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pointr-btn pointr-primary";
    btn.textContent = "I did it";
    btn.addEventListener("click", () => Pointr.watcher.confirmInfo());
    card.append(eyebrow, text, btn);
  }

  function showScroll(step, turn) {
    const down = step.scrollDirection !== "up";
    const arrow = add(div(`pointr-arrow ${down ? "pointr-down" : "pointr-up"}`));
    arrow.append(Pointr.icons.scrollArrow(!down));
    const cap = add(caption(step, turn));
    const ARROW_SPACE = 28 + 64 + 18; // edge offset + arrow + gap
    const place = () => {
      const w = cap.offsetWidth;
      const h = cap.offsetHeight;
      const left = Math.max(MARGIN, (window.innerWidth - w) / 2);
      const top = down ? window.innerHeight - ARROW_SPACE - h : ARROW_SPACE;
      cap.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    place();
    relayout = place;
    window.addEventListener("resize", place);
    cleanups.push(() => window.removeEventListener("resize", place));
    flush(cap);
    cap.classList.add("pointr-on");
  }

  // opts: { replace?: boolean } (a same-turn step replacing the one on screen)
  function showStep(step, element, turn, opts = {}) {
    const fromRing = opts.replace ? lastRing : null;
    clear();
    if (!Pointr.shadow) return;
    if ((step.action === "click" || step.action === "type" || step.action === "show") && element) {
      showPointing(step, element, turn, { replace: !!fromRing, fromRing });
    }
    else if (step.action === "scroll") showScroll(step, turn);
    else showInfo(step, turn);
  }

  // The model confirmed the predicted step with (maybe) different words.
  function updateCaption(step) {
    const text = Pointr.shadow && Pointr.shadow.querySelector(".pointr-caption-text");
    if (!text || text.textContent === step.instruction) return;
    text.textContent = step.instruction;
    if (relayout) relayout();
  }

  Pointr.overlay = { showStep, clear, complete, updateCaption };
})();
