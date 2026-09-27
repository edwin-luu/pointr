const MIN_CAPTURE_GAP_MS = 600;
const MAX_OUTPUT_WIDTH = 1280;

const MARK_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

let lastCaptureAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enforceCaptureGap() {
  const elapsed = Date.now() - lastCaptureAt;
  if (elapsed < MIN_CAPTURE_GAP_MS) {
    await sleep(MIN_CAPTURE_GAP_MS - elapsed);
  }
}

function blobToBase64(blob) {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  });
}

// Landmarks (text/heading, only for "show" steps): dashed gray box + gray tag,
// so the model can tell plain text from things to click.
const LANDMARK_ROLES = new Set(["text", "heading"]);
const LANDMARK_COLOR = "#6B7280";

// Tag placement (ARCHITECTURE 8 step 4). The bug this avoids: a tag drawn outside a
// box sat right next to a NEIGHBOUR's box and read as the neighbour's number.
// Rules: a tag never overlaps another tag; an outside tag must keep CLEARANCE
// px away from every other box, so it only touches its own box; boxes tall
// enough to hold a tag above their text get it inside the top-left corner;
// single-line boxes prefer a clear outside spot (so the tag does not hide the
// first letters of their text) and fall back to inside.
const INSIDE_MIN_W = 28;
const INSIDE_MIN_H = 18;
const CLEARANCE = 3;

function intersects(a, b, margin = 0) {
  return (
    a.x - margin < b.x + b.w && a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h && a.y + a.h + margin > b.y
  );
}

function clampInto(r, cw, ch) {
  return {
    ...r,
    x: Math.min(Math.max(r.x, 0), cw - r.w),
    y: Math.min(Math.max(r.y, 0), ch - r.h),
  };
}

// Candidate tag rects for one box, in order of preference.
function tagCandidates(box, tw, th) {
  const { x, y, w, h } = box;
  const outside = [
    { x: x - tw, y }, // left
    { x, y: y - th }, // above-left
    { x: x + w - tw, y: y - th }, // above-right
    { x: x + w, y }, // right
    { x, y: y + h }, // below-left
  ].map((p) => ({ ...p, inside: false }));
  const inside = [
    { x, y }, // top-left
    { x: x + w - tw, y }, // top-right
    { x, y: y + h - th }, // bottom-left
  ].map((p) => ({ ...p, inside: true }));
  const fits = w >= INSIDE_MIN_W && h >= INSIDE_MIN_H;
  const tall = h >= 2 * th;
  const order = !fits ? outside : tall ? [...inside, ...outside] : [...outside, ...inside];
  return order.map((p) => ({ ...p, w: tw, h: th }));
}

// First candidate that overlaps no tag and no other box (outside ones with
// clearance); else the one touching the fewest other boxes.
function placeTag(box, tw, th, placedTags, boxes, selfIdx, cw, ch) {
  let best = null;
  let bestHits = Infinity;
  for (const cand of tagCandidates(box, tw, th)) {
    const r = clampInto(cand, cw, ch);
    if (placedTags.some((t) => intersects(t, r))) continue;
    const margin = r.inside ? 0 : CLEARANCE;
    let hits = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (i !== selfIdx && intersects(boxes[i], r, margin)) hits++;
    }
    if (hits === 0) return r;
    if (hits < bestHits) {
      best = r;
      bestHits = hits;
    }
  }
  return best || clampInto({ x: box.x, y: box.y, w: tw, h: th }, cw, ch);
}

// Returns { screenshot, captureMs, marksMs }. captureMs includes any wait
// forced by the captureVisibleTab rate limit, so it is the real stage cost.
export async function captureWithMarks(windowId, page, elements) {
  const t0 = performance.now();
  await enforceCaptureGap();

  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 80 });
  lastCaptureAt = Date.now();
  const t1 = performance.now();

  const blob = await fetch(dataUrl).then((r) => r.blob());
  const bitmap = await createImageBitmap(blob);

  const scale = bitmap.width / page.viewport.width;
  const outputWidth = Math.min(MAX_OUTPUT_WIDTH, bitmap.width);
  const k = outputWidth / bitmap.width;
  const outputHeight = Math.round(bitmap.height * k);

  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, outputWidth, outputHeight);

  const factor = scale * k;
  const fontSize = Math.max(12, Math.round(14 * k));

  const boxes = elements.map((el) => ({
    x: el.rect.x * factor,
    y: el.rect.y * factor,
    w: el.rect.w * factor,
    h: el.rect.h * factor,
  }));
  const colorOf = (el, idx) => (LANDMARK_ROLES.has(el.role) ? LANDMARK_COLOR : MARK_COLORS[idx % MARK_COLORS.length]);

  // 1. All boxes first, so no box stroke is drawn across a tag.
  ctx.lineWidth = 2;
  elements.forEach((el, idx) => {
    const b = boxes[idx];
    ctx.setLineDash(LANDMARK_ROLES.has(el.role) ? [5, 3] : []);
    ctx.strokeStyle = colorOf(el, idx);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  });
  ctx.setLineDash([]);

  // 2. Tags on top, each placed where it cannot be mistaken for a neighbour's.
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = "middle";
  const tagHeight = fontSize + 6;
  const placedTags = [];
  elements.forEach((el, idx) => {
    const label = String(el.id);
    const tagWidth = Math.ceil(ctx.measureText(label).width) + 8;
    const tag = placeTag(boxes[idx], tagWidth, tagHeight, placedTags, boxes, idx, outputWidth, outputHeight);
    placedTags.push(tag);
    ctx.fillStyle = colorOf(el, idx);
    ctx.fillRect(tag.x, tag.y, tag.w, tag.h);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, tag.x + 4, tag.y + tag.h / 2 + 1);
  });

  const outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  const screenshot = await blobToBase64(outBlob);
  return {
    screenshot,
    captureMs: Math.round(t1 - t0),
    marksMs: Math.round(performance.now() - t1),
  };
}
