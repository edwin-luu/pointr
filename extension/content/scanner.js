globalThis.Pointr = globalThis.Pointr || {};

(function () {
  const CANDIDATE_SELECTOR = [
    "a[href]",
    "button",
    "input:not([type=hidden])",
    "select",
    "textarea",
    "summary",
    "[contenteditable='']",
    "[contenteditable='true']",
    "[role=button]",
    "[role=link]",
    "[role=checkbox]",
    "[role=radio]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=option]",
    "[role=switch]",
    "[role=textbox]",
    "[role=combobox]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");

  const ALLOWED_ROLES = new Set([
    "button",
    "link",
    "checkbox",
    "radio",
    "tab",
    "menuitem",
    "option",
    "switch",
    "textbox",
    "combobox",
  ]);

  const MAX_ELEMENTS = 150;

  // Text landmarks: only targets for "show" steps ("what's my balance?").
  const MAX_LANDMARKS = 40;
  const MAX_DATA_TEXT = 60;
  const HEADING_SELECTOR = "h1, h2, h3, [role=heading]";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE"]);
  const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  const DATA_PATTERNS = [
    /-?\$\s?\d/, // money: $1,234.56, -$12.00
    /\d\s?%/, // percentage
    /\d{2,}/, // a number with 2+ digits
    new RegExp(`\\b${MONTH}\\s+\\d{1,4}\\b`, "i"), // Oct 12, September 2026
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, // 10/12/2026
  ];

  let latestScanId = 0;
  let latestMap = new Map(); // id -> Element

  function isPointrHost(el) {
    return el.tagName && el.tagName.toLowerCase() === "pointr-root";
  }

  function insidePointrHost(el) {
    let node = el;
    while (node) {
      if (isPointrHost(node)) return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function getParentAcrossShadow(el) {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    if (root instanceof ShadowRoot) return root.host;
    return null;
  }

  function collectCandidates(root, out) {
    const found = root.querySelectorAll(CANDIDATE_SELECTOR);
    for (const el of found) out.push(el);

    // Recurse into every open shadow root under `root`.
    const all = root.querySelectorAll("*");
    for (const el of all) {
      if (el.shadowRoot) {
        collectCandidates(el.shadowRoot, out);
      }
    }
  }

  function intersectsViewport(rect) {
    return (
      rect.width >= 4 &&
      rect.height >= 4 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    );
  }

  function isStyleVisible(el) {
    const style = getComputedStyle(el);
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) <= 0.05 && !isClearOverlayControl(el)) return false;
    if (el.disabled) return false;
    return true;
  }

  // A see-through form control laid over a painted button or dropdown, so the
  // user's click lands on it (Amazon's "Add to cart" / "Buy Now" are
  // opacity-0 <input>s over a styled span; many sites style <select> the same
  // way). Kept only if it is real-sized and its wrapper is visible; the
  // topmost check still applies afterwards.
  const OVERLAY_TAGS = new Set(["INPUT", "SELECT", "BUTTON"]);
  function isClearOverlayControl(el) {
    if (!OVERLAY_TAGS.has(el.tagName)) return false;
    if (el.tagName === "INPUT" && (el.type === "hidden" || el.type === "file")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return false;
    const wrap = getParentAcrossShadow(el);
    if (!wrap || !wrap.getBoundingClientRect) return false;
    const ws = getComputedStyle(wrap);
    if (ws.visibility === "hidden" || parseFloat(ws.opacity) <= 0.05) return false;
    const w = wrap.getBoundingClientRect();
    const overlapW = Math.min(r.right, w.right) - Math.max(r.left, w.left);
    const overlapH = Math.min(r.bottom, w.bottom) - Math.max(r.top, w.top);
    return overlapW > 0 && overlapH > 0 && (overlapW * overlapH) / (r.width * r.height) >= 0.5;
  }

  function isAriaHiddenChain(el) {
    let node = el;
    while (node) {
      if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function elementFromPointInContext(el, x, y) {
    const root = el.getRootNode();
    if (root instanceof ShadowRoot && typeof root.elementFromPoint === "function") {
      return root.elementFromPoint(x, y);
    }
    return document.elementFromPoint(x, y);
  }

  function isDescendantOrSelf(target, candidate) {
    let node = candidate;
    while (node) {
      if (node === target) return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  function isTopmost(el, rect) {
    const visibleLeft = Math.max(rect.left, 0);
    const visibleRight = Math.min(rect.right, window.innerWidth);
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);
    const midY = (visibleTop + visibleBottom) / 2;

    const points = [
      [(visibleLeft + visibleRight) / 2, midY],
      [visibleLeft + (visibleRight - visibleLeft) * 0.25, midY],
      [visibleLeft + (visibleRight - visibleLeft) * 0.75, midY],
    ];

    for (const [x, y] of points) {
      const hit = elementFromPointInContext(el, x, y);
      if (hit && isDescendantOrSelf(el, hit)) return true;
    }
    return false;
  }

  function collapseWhitespace(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function labelFromAriaLabelledBy(el) {
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    if (ids.length === 0) return "";
    const root = el.getRootNode();
    const texts = [];
    for (const id of ids) {
      const target = root.getElementById ? root.getElementById(id) : document.getElementById(id);
      if (target) texts.push(collapseWhitespace(target.innerText || target.textContent));
    }
    return texts.join(" ").trim();
  }

  function labelFromWrappingLabel(el) {
    if (el.id) {
      const root = el.getRootNode();
      const forLabel = root.querySelector
        ? root.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        : null;
      if (forLabel) return collapseWhitespace(forLabel.innerText || forLabel.textContent);
    }
    const wrapping = el.closest ? el.closest("label") : null;
    if (wrapping) return collapseWhitespace(wrapping.innerText || wrapping.textContent);
    return "";
  }

  function computeLabel(el) {
    const ariaLabel = el.getAttribute && el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim().slice(0, 80);

    const labelledBy = labelFromAriaLabelledBy(el);
    if (labelledBy) return labelledBy.slice(0, 80);

    const wrappingLabel = labelFromWrappingLabel(el);
    if (wrappingLabel) return wrappingLabel.slice(0, 80);

    const innerText = collapseWhitespace(el.innerText || el.textContent);
    if (innerText) return innerText.slice(0, 80);

    const placeholder = el.getAttribute && el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) return placeholder.trim().slice(0, 80);

    const title = el.getAttribute && el.getAttribute("title");
    if (title && title.trim()) return title.trim().slice(0, 80);

    const firstImg = el.querySelector ? el.querySelector("img") : null;
    if (firstImg) {
      const alt = firstImg.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim().slice(0, 80);
    }

    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "submit" || type === "button") {
        const value = el.getAttribute("value");
        if (value && value.trim()) return value.trim().slice(0, 80);
      }
    }

    const name = el.getAttribute && el.getAttribute("name");
    if (name && name.trim()) return name.trim().slice(0, 80);

    return "";
  }

  function computeRole(el) {
    const explicitRole = (el.getAttribute && el.getAttribute("role") || "").toLowerCase();
    if (ALLOWED_ROLES.has(explicitRole)) return explicitRole;

    const tag = el.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "submit" || type === "button" || type === "reset") return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (el.isContentEditable) return "textbox";
    return "other";
  }

  function computeInputType(el) {
    if (el.tagName && el.tagName.toLowerCase() === "input") {
      return (el.getAttribute("type") || "text").toLowerCase();
    }
    return undefined;
  }

  // Only typeable elements get hasValue (a checkbox's .value is "on", which
  // would wrongly read as "already filled in").
  function computeHasValue(el, role) {
    if (role !== "textbox" && role !== "combobox") return undefined;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") {
      return el.value.length > 0;
    }
    if (tag === "select") {
      return !!el.value;
    }
    if (el.isContentEditable) {
      return collapseWhitespace(el.innerText || el.textContent).length > 0;
    }
    return false;
  }

  // checkbox/radio/switch state. Native inputs use .checked; ARIA widgets use
  // aria-checked ("mixed" is left out: it is neither on nor off).
  // tab: aria-selected, so the model knows which tab is already open.
  function computeChecked(el, role) {
    if (role === "tab") {
      const selected = el.getAttribute && el.getAttribute("aria-selected");
      return selected === "true" ? true : selected === "false" ? false : undefined;
    }
    if (role !== "checkbox" && role !== "radio" && role !== "switch") return undefined;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input") return !!el.checked;
    const aria = el.getAttribute && el.getAttribute("aria-checked");
    if (aria === "true") return true;
    if (aria === "false") return false;
    return undefined;
  }

  function computeFocused(el) {
    const root = el.getRootNode();
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    return active === el;
  }

  function rectArea(rect) {
    return rect.width * rect.height;
  }

  function overlapRatio(a, b) {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return 0;
    const intersection = (right - left) * (bottom - top);
    const smaller = Math.min(rectArea(a), rectArea(b));
    return smaller === 0 ? 0 : intersection / smaller;
  }

  function dedupe(items) {
    // items: [{el, rect, role}], in document order.
    const kept = [];
    for (const item of items) {
      let dropped = false;
      for (let i = 0; i < kept.length; i++) {
        const other = kept[i];
        const isAncestor = isDescendantOrSelf(other.el, item.el) && other.el !== item.el;
        const isDescendant = isDescendantOrSelf(item.el, other.el) && other.el !== item.el;
        if (!isAncestor && !isDescendant) continue;

        const ratio = overlapRatio(item.rect, other.rect);
        if (ratio <= 0.85) continue;

        if (isAncestor) {
          // item is a descendant of other (already kept, the outer one).
          if (item.role === "textbox") {
            // Keep the inner textbox instead of the outer.
            kept.splice(i, 1);
            break;
          }
          dropped = true;
          break;
        }
        if (isDescendant) {
          // item is an ancestor of an already-kept inner element.
          if (other.role === "textbox") {
            dropped = true;
            break;
          }
          kept.splice(i, 1);
          break;
        }
      }
      if (!dropped) kept.push(item);
    }
    return kept;
  }

  // The element's OWN text: its direct text nodes joined, whitespace collapsed.
  function ownText(el) {
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
    }
    return collapseWhitespace(text);
  }

  function isDataText(text) {
    return text.length >= 1 && text.length <= MAX_DATA_TEXT && DATA_PATTERNS.some((re) => re.test(text));
  }

  function collectAllElements(root, out) {
    for (const el of root.querySelectorAll("*")) {
      out.push(el);
      if (el.shadowRoot) collectAllElements(el.shadowRoot, out);
    }
  }

  // Text in a <label> belongs to its control (clicking it toggles the radio
  // or focuses the field), so it is part of that element, not a landmark.
  function insideInteractive(el) {
    let node = el;
    while (node) {
      if (node.matches && (node.matches(CANDIDATE_SELECTOR) || node.tagName === "LABEL")) return true;
      node = getParentAcrossShadow(node);
    }
    return false;
  }

  // Headings + data-ish text, visible and topmost, not inside anything
  // interactive and not nested in (or around) another landmark.
  function scanLandmarks() {
    const all = [];
    collectAllElements(document, all);
    const found = [];
    for (const el of all) {
      if (SKIP_TAGS.has(el.tagName.toUpperCase())) continue;
      const isHeading = el.matches(HEADING_SELECTOR);
      let label = "";
      if (isHeading) {
        label = collapseWhitespace(el.innerText || el.textContent).slice(0, 80);
      } else {
        const own = ownText(el);
        if (!isDataText(own)) continue;
        label = own;
      }
      if (!label) continue;
      if (insidePointrHost(el) || insideInteractive(el)) continue;
      if (found.some((f) => isDescendantOrSelf(f.el, el) || isDescendantOrSelf(el, f.el))) continue;

      const rect = el.getBoundingClientRect();
      if (!intersectsViewport(rect)) continue;
      if (!isStyleVisible(el)) continue;
      if (isAriaHiddenChain(el)) continue;
      if (!isTopmost(el, rect)) continue;
      found.push({ el, rect, role: isHeading ? "heading" : "text", label });
    }
    if (found.length <= MAX_LANDMARKS) return found;
    // Too many: keep those closest to the top of the viewport, in page order.
    const keep = new Set(
      [...found].sort((a, b) => Math.max(a.rect.top, 0) - Math.max(b.rect.top, 0)).slice(0, MAX_LANDMARKS)
    );
    return found.filter((f) => keep.has(f));
  }

  function scan() {
    const rawCandidates = [];
    collectCandidates(document, rawCandidates);

    const items = [];
    const seen = new Set();

    for (const el of rawCandidates) {
      if (seen.has(el)) continue;
      seen.add(el);

      if (insidePointrHost(el)) continue;

      const rect = el.getBoundingClientRect();
      if (!intersectsViewport(rect)) continue;
      if (!isStyleVisible(el)) continue;
      if (isAriaHiddenChain(el)) continue;
      if (!isTopmost(el, rect)) continue;

      const role = computeRole(el);
      items.push({ el, rect, role });
    }

    const deduped = dedupe(items);

    let capped = deduped;
    if (deduped.length > MAX_ELEMENTS) {
      capped = [...deduped]
        .sort((a, b) => rectArea(b.rect) - rectArea(a.rect))
        .slice(0, MAX_ELEMENTS);
      // Re-sort by original document order (index in `deduped`).
      const order = new Map(deduped.map((item, idx) => [item, idx]));
      capped.sort((a, b) => order.get(a) - order.get(b));
    }

    const map = new Map();
    const elements = capped.map((item, idx) => {
      const id = idx + 1;
      map.set(id, item.el);
      const role = item.role;
      const info = {
        id,
        role,
        label: computeLabel(item.el),
        rect: {
          x: Math.round(item.rect.left),
          y: Math.round(item.rect.top),
          w: Math.round(item.rect.width),
          h: Math.round(item.rect.height),
        },
      };
      const inputType = computeInputType(item.el);
      if (inputType !== undefined) info.inputType = inputType;
      const hasValue = computeHasValue(item.el, role);
      if (hasValue !== undefined) info.hasValue = hasValue;
      const checked = computeChecked(item.el, role);
      if (checked !== undefined) info.checked = checked;
      const focused = computeFocused(item.el);
      if (focused) info.focused = true;
      return info;
    });

    // Landmark ids continue after the interactive ids.
    for (const lm of scanLandmarks()) {
      const id = elements.length + 1;
      map.set(id, lm.el);
      elements.push({
        id,
        role: lm.role,
        label: lm.label,
        rect: {
          x: Math.round(lm.rect.left),
          y: Math.round(lm.rect.top),
          w: Math.round(lm.rect.width),
          h: Math.round(lm.rect.height),
        },
      });
    }

    latestScanId += 1;
    latestMap = map;

    const page = {
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollY: Math.round(window.scrollY),
      scrollMaxY: Math.max(
        0,
        Math.round(document.scrollingElement.scrollHeight - window.innerHeight)
      ),
    };

    return { scanId: latestScanId, page, elements };
  }

  function getElement(id) {
    return latestMap.get(id) || null;
  }

  function debugDraw(result) {
    if (!Pointr.shadow) return;
    const old = Pointr.shadow.querySelectorAll(".pointr-debug-tag, .pointr-debug-box");
    old.forEach((n) => n.remove());

    for (const info of result.elements) {
      const box = document.createElement("div");
      box.className = "pointr-debug-box";
      box.style.left = `${info.rect.x}px`;
      box.style.top = `${info.rect.y}px`;
      box.style.width = `${info.rect.w}px`;
      box.style.height = `${info.rect.h}px`;
      Pointr.shadow.appendChild(box);

      const tag = document.createElement("div");
      tag.className = "pointr-debug-tag";
      tag.textContent = String(info.id);
      tag.style.left = `${info.rect.x}px`;
      tag.style.top = `${Math.max(0, info.rect.y - 16)}px`;
      Pointr.shadow.appendChild(tag);
    }
  }

  Pointr.scanner = {
    scan,
    getElement,
    debugDraw,
    CANDIDATE_SELECTOR,
    isDescendantOrSelf,
    elementFromPointInContext,
  };
})();
