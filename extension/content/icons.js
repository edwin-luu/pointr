globalThis.Pointr = globalThis.Pointr || {};

// Inline SVG icons, built with createElementNS (no innerHTML: some sites
// enforce Trusted Types). Shapes come from pointer-demo.html.
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function make(viewBox, width, height, parts, className) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) svg.setAttribute("class", className);
    for (const [tag, attrs] of parts) {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      svg.appendChild(node);
    }
    return svg;
  }

  const ARROW = "M2 2 L2 32 L10 25 L16 38 L22 35 L16 23 L27 23 Z";

  Pointr.icons = {
    // The ghost cursor: yellow arrow with a navy outline (34x40 before scaling).
    cursor: (className) =>
      make("0 0 34 40", 34, 40, [[
        "path",
        { d: ARROW, fill: "#FFD23F", stroke: "#26235C", "stroke-width": 2.5, "stroke-linejoin": "round" },
      ]], className),
    // Flat yellow arrow: the Pointr logo on navy.
    logo: (width = 22) =>
      make("0 0 34 40", width, Math.round((width * 40) / 34), [["path", { d: ARROW, fill: "#FFD23F" }]], "pointr-logo"),
    mic: () =>
      make("0 0 18 22", 16, 20, [
        ["rect", { x: 5, y: 1, width: 8, height: 13, rx: 4, fill: "currentColor" }],
        ["path", { d: "M1.5 10a7.5 7.5 0 0 0 15 0M9 17.5V21", stroke: "currentColor", "stroke-width": 2, fill: "none", "stroke-linecap": "round" }],
      ]),
    check: (size = 16, color = "#fff", weight = 3) =>
      make("0 0 20 20", size, size, [
        ["path", { d: "M4.5 10.5 L8.5 14.5 L15.5 6", stroke: color, "stroke-width": weight, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }],
      ]),
    chevronDown: () =>
      make("0 0 24 24", 24, 24, [
        ["path", { d: "M6 9.5 L12 15.5 L18 9.5", stroke: "#FFD23F", "stroke-width": 2.8, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }],
      ]),
    scrollArrow: (up) =>
      make("0 0 24 24", 30, 30, [
        ["path", {
          d: up ? "M12 20V5M5 11.5L12 4.5L19 11.5" : "M12 4V19M5 12.5L12 19.5L19 12.5",
          stroke: "#26235C", "stroke-width": 3, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
        }],
      ]),
  };
})();
