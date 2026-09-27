globalThis.Pointr = globalThis.Pointr || {};

// Push-to-talk glue (ARCHITECTURE 13). Recording happens in the extension's
// offscreen document (mic permission granted once, to the extension), driven
// by sw/voice.js; this file only opens the goal box and relays state to the
// widget. No voice output, ever.
Pointr.voice = {
  // The mic button or Alt+X (POINTR_TOGGLE_VOICE): start or stop recording.
  // During a task it stops the task first and records a new goal.
  toggle() {
    const w = Pointr.widget;
    if (w.inSession()) {
      Pointr.send({ type: "POINTR_STOP" });
      Pointr.watcher.disarm();
      Pointr.overlay.clear();
      w.setState("open");
    } else if (w.getState() !== "open") {
      w.setState("open");
    }
    Pointr.send({ type: "POINTR_VOICE_TOGGLE" });
  },

  // POINTR_VOICE_STATE { state, text?, error? } from the SW.
  onState(message) {
    Pointr.widget.setVoice(message);
  },
};
