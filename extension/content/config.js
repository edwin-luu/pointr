globalThis.Pointr = globalThis.Pointr || {};

// Visual tunables (ARCHITECTURE section 9). Everything the overlay and widget
// draw reads from here. Tuning workflow: change a number, click reload on
// Pointr in chrome://extensions, refresh the page.
Pointr.config = {
  // Page dim outside the ring (alpha 0..1). pointer-demo.html uses 0.52.
  // 0 turns dimming off (the ring still shows).
  dim: 0.52,
  // RGB of the dim layer (a deep navy, not black, so the page reads as "behind" Pointr).
  dimColor: "20,18,56",

  // The ring drawn around the target.
  ringColor: "#FFD23F",
  ringWidth: 4, // border thickness, px
  ringPad: 7, // gap between the element's edge and the ring, px
  ringRadius: 12, // corner radius, px

  // Ghost cursor: the 34x40 pointer-demo arrow times this scale.
  cursorScale: 1.4,
  // Ghost opacity once the user's real mouse is near the target (it fades so
  // it never hides what the user is about to click).
  cursorNearOpacity: 0.3,
  nearPx: 60, // real mouse within this distance of the ring -> ghost fades, pulse stops
  farPx: 250, // real mouse farther than this ...
  farMs: 2000, // ... for this long -> ghost solid again, pulse resumes
  glideMs: 800, // ghost cursor / ring glide to a new target

  // Caption ("tip") under or above the ring.
  captionMaxWidth: 330, // px
  captionGap: 14, // ring -> caption, px

  // Green check flash on the ring when the user did the step.
  completeMs: 400,
};
