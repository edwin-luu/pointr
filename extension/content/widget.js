globalThis.Pointr = globalThis.Pointr || {};

// Launcher + mini panel. States: idle (launcher only), open (goal box),
// thinking + guiding (a compact pill), checkin, done, error. No chat
// transcript anywhere: the goal box is the only text input.
(function () {
  const DONE_COLLAPSE_MS = 3000;
  const VOICE_SEND_DELAY_MS = 300; // heard text stays visible this long before it is sent

  let dockEl = null;
  let launcherEl = null;
  let panelEl = null;
  let state = "idle";
  let goal = "";
  let draft = ""; // unsent goal text survives state changes
  let doneTimer = 0;
  let sendTimer = 0;
  // Voice input inside the open goal box: "off" | "recording" | "transcribing".
  let voice = "off";
  let note = null; // { text, bad } line under the goal box

  function send(message) {
    return Pointr.send ? Pointr.send(message) : Promise.resolve(null);
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(label, onClick, kind) {
    const b = el("button", kind ? `pointr-btn ${kind}` : "pointr-btn", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function inSession() {
    return state === "thinking" || state === "guiding" || state === "checkin" || state === "error";
  }

  // Stop from any session state: tell the SW, and clear locally right away
  // so it feels instant (the SW's POINTR_ENDED arrives a moment later).
  function stop() {
    send({ type: "POINTR_STOP" });
    Pointr.watcher.disarm();
    Pointr.overlay.clear();
    setState("idle");
  }

  function submitGoal(text) {
    const g = text.trim();
    if (!g) return;
    draft = "";
    note = null;
    setState("thinking", { goal: g });
    send({ type: "POINTR_START", goal: g });
  }

  function header() {
    const head = el("div", "pointr-head");
    head.append(Pointr.icons.logo(18), el("div", "pointr-title", "Pointr"));
    return head;
  }

  function goalBox() {
    const field = el("div", "pointr-field");
    const ta = el("textarea");
    ta.setAttribute("aria-label", "What do you want to do?");
    ta.placeholder =
      voice === "recording" ? "Listening... press Alt+X or the mic to finish"
      : voice === "transcribing" ? "Got it, one moment..."
      : "What do you want to do?";
    ta.readOnly = voice !== "off";
    ta.value = voice === "off" ? draft : "";
    ta.addEventListener("input", () => (draft = ta.value));
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (voice === "off") submitGoal(ta.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    const mic = el("button", "pointr-mic");
    mic.type = "button";
    if (voice === "recording") {
      mic.classList.add("pointr-live");
      mic.setAttribute("aria-label", "Stop recording");
      mic.title = "Stop recording (Alt+X)";
      mic.append(Pointr.icons.mic());
    } else if (voice === "transcribing") {
      mic.classList.add("pointr-busy");
      mic.disabled = true;
      mic.setAttribute("aria-label", "Transcribing");
      mic.append(el("span", "pointr-spin"));
    } else {
      mic.setAttribute("aria-label", "Speak your goal");
      mic.title = "Speak your goal (Alt+X)";
      mic.append(Pointr.icons.mic());
    }
    mic.addEventListener("click", () => Pointr.voice.toggle());

    field.append(ta, mic);
    return { field, ta };
  }

  function close() {
    if (voice === "recording") Pointr.voice.toggle(); // stop; the result is discarded below
    voice = "off";
    note = null;
    setState("idle");
  }

  function pill(eyebrow, busy) {
    const badge = el("div", "pointr-badge");
    badge.append(busy ? el("span", "pointr-spin") : Pointr.icons.logo(18));
    const text = el("div", "pointr-pill-text");
    text.append(el("span", busy ? "pointr-pill-eyebrow pointr-dots" : "pointr-pill-eyebrow", eyebrow));
    text.append(el("span", "pointr-pill-goal", goal));
    panelEl.append(badge, text, button("Stop", stop, "pointr-small"));
  }

  function render(extra) {
    panelEl.replaceChildren();
    panelEl.dataset.state = state;
    panelEl.hidden = state === "idle";
    launcherEl.hidden = !(state === "idle" || state === "open");
    launcherEl.replaceChildren(state === "open" ? Pointr.icons.chevronDown() : Pointr.icons.logo(22));
    launcherEl.setAttribute("aria-label", state === "open" ? "Close Pointr" : "Open Pointr");
    launcherEl.setAttribute("aria-expanded", String(state === "open"));
    if (state === "idle") return;

    switch (state) {
      case "open": {
        const { field, ta } = goalBox();
        panelEl.append(header(), field);
        if (note) panelEl.append(el("div", note.bad ? "pointr-note pointr-bad" : "pointr-note", note.text));
        const row = el("div", "pointr-row");
        row.append(
          button("Close", close),
          button("Send", () => voice === "off" && submitGoal(ta.value), "pointr-primary")
        );
        panelEl.append(row);
        if (voice === "off") setTimeout(() => ta.isConnected && ta.focus(), 0);
        break;
      }
      case "thinking":
        pill("Looking", true);
        break;
      case "guiding":
        pill("Helping you", false);
        break;
      case "checkin": {
        const msg = el("div", "pointr-msg");
        msg.append("Still want help with: ", el("strong", "", goal), "?");
        const row = el("div", "pointr-row");
        row.append(
          button("Stop", stop),
          button("Keep going", () => {
            setState("thinking");
            send({ type: "POINTR_CHECKIN_ANSWER", keepGoing: true });
          }, "pointr-primary")
        );
        panelEl.append(header(), msg, row);
        break;
      }
      case "done": {
        const mark = el("div", "pointr-win-mark");
        mark.append(Pointr.icons.check(26, "#FFD23F", 3.2));
        panelEl.append(mark, el("div", "pointr-big", "You did it!"));
        if (extra && extra.message) panelEl.append(el("div", "pointr-msg", extra.message));
        break;
      }
      case "error": {
        const alert = el("div", "pointr-alert");
        alert.append(
          el("span", "pointr-alert-mark", "!"),
          el("div", "pointr-msg", (extra && extra.message) || "Something went wrong.")
        );
        const row = el("div", "pointr-row");
        row.append(button(extra && extra.retryable ? "Stop" : "Close", stop));
        if (extra && extra.retryable) {
          row.append(button("Try again", () => {
            setState("thinking");
            send({ type: "POINTR_RETRY" });
          }, "pointr-primary"));
        }
        panelEl.append(header(), alert, row);
        break;
      }
    }
  }

  // extra: { goal?, message?, retryable? }
  function setState(next, extra) {
    clearTimeout(doneTimer);
    clearTimeout(sendTimer);
    if (extra && extra.goal !== undefined) goal = extra.goal;
    if (next !== "open") voice = "off";
    state = next;
    if (next === "idle" || next === "open") avoid(null);
    render(extra);
    if (next === "done") doneTimer = setTimeout(() => setState("idle"), DONE_COLLAPSE_MS);
  }

  // Voice input (POINTR_VOICE_STATE from the SW, via content/voice.js).
  // { state: "recording"|"transcribing"|"idle"|"error", text?, error? }
  function setVoice(msg) {
    if (msg.state === "recording" || msg.state === "transcribing") {
      if (state !== "open") setState("open");
      voice = msg.state;
      note = null;
      render();
      return;
    }
    const wasActive = voice !== "off";
    voice = "off";
    if (msg.state === "error") {
      if (state !== "open") setState("open");
      note = { text: msg.error || "Voice input had a problem. Try again or type instead.", bad: true };
      render();
      return;
    }
    // idle: with text -> show it, then send it.
    if (state !== "open") return;
    const text = (msg.text || "").trim();
    if (!wasActive) return render();
    if (!text) {
      note = { text: "I couldn't hear anything, try again", bad: true };
      return render();
    }
    draft = text;
    note = null;
    render();
    sendTimer = setTimeout(() => {
      if (state === "open" && voice === "off") submitGoal(draft);
    }, VOICE_SEND_DELAY_MS);
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  // The widget must never cover the current target: if it would, move the
  // dock to the bottom-left corner (and back once the target is clear).
  function avoid(targetRect) {
    if (!dockEl) return;
    const isLeft = dockEl.classList.contains("pointr-left");
    if (!targetRect) {
      if (isLeft) dockEl.classList.remove("pointr-left");
      return;
    }
    const pad = 8;
    const t = {
      left: targetRect.left - pad,
      top: targetRect.top - pad,
      right: targetRect.right + pad,
      bottom: targetRect.bottom + pad,
    };
    // Compare against where the dock would be on the RIGHT side.
    const r = dockEl.getBoundingClientRect();
    const rightSide = isLeft
      ? { left: window.innerWidth - 24 - r.width, right: window.innerWidth - 24, top: r.top, bottom: r.bottom }
      : r;
    const wantLeft = rectsOverlap(rightSide, t);
    if (wantLeft !== isLeft) dockEl.classList.toggle("pointr-left", wantLeft);
  }

  // Where the dock is on screen (the caption avoids it), or null.
  function rect() {
    if (!dockEl) return null;
    const r = dockEl.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }

  // Where the ghost cursor starts its first glide: the Pointr logo in the
  // pill (or the launcher).
  function anchor() {
    const from = panelEl.querySelector(".pointr-badge") || (launcherEl.hidden ? null : launcherEl);
    if (!from) return null;
    const r = from.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  function build() {
    dockEl = el("div", "pointr-dock");
    panelEl = el("div", "pointr-panel");
    panelEl.hidden = true;
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Pointr");

    launcherEl = el("button", "pointr-launcher");
    launcherEl.type = "button";
    launcherEl.title = "Pointr (Alt+X to talk)";
    launcherEl.addEventListener("click", () => {
      if (state === "idle" || state === "done") setState("open");
      else if (state === "open") close();
    });

    dockEl.append(panelEl, launcherEl);
    Pointr.shadow.appendChild(dockEl);
    render();
  }

  function openPanel() {
    if (state === "idle" || state === "done") setState("open");
    else panelEl.hidden = false;
  }

  Pointr.widget = {
    init: build,
    setState,
    setVoice,
    openPanel,
    avoid,
    rect,
    anchor,
    inSession,
    getState: () => state,
  };
})();
