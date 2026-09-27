// Scanner check on tricky real-world markup (no model calls): a local page
// served through Playwright routing copies patterns seen on real sites, and
// the real content script's scan must (not) list each control.
// Usage: node scanner-cases.mjs
import { launch } from "./harness.mjs";

const PAGE = `<!doctype html><html><head><title>Scanner cases</title><style>
  body { font: 16px sans-serif; margin: 40px; }
  .a-button { display: inline-block; position: relative; margin: 8px 0; border-radius: 20px; background: #ffd814; }
  .a-button-inner { display: block; position: relative; padding: 0; }
  .a-button-input { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; opacity: .01; cursor: pointer; z-index: 20; }
  .a-button-text { display: block; padding: 8px 60px; }
  .a-dropdown-container { position: relative; display: inline-block; }
  .a-native-dropdown { position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; z-index: 5; }
  .a-dropdown-prompt { display: inline-block; padding: 6px 30px; border: 1px solid #888; border-radius: 8px; }
  .gone { opacity: 0; }
</style></head><body>
  <h1>Scanner cases</h1>
  <!-- Amazon buy box: see-through inputs over painted spans -->
  <span class="a-button"><span class="a-button-inner">
    <input id="add-to-cart-button" type="submit" name="submit.add-to-cart" aria-labelledby="atc-announce" class="a-button-input">
    <span id="atc-announce" class="a-button-text">Add to cart</span></span></span><br>
  <span class="a-button"><span class="a-button-inner">
    <input id="buy-now-button" type="submit" name="submit.buy-now" aria-labelledby="bn-announce" class="a-button-input">
    <span id="bn-announce" class="a-button-text">Buy Now</span></span></span><br>
  <!-- styled native select -->
  <label for="quantity">Quantity:</label>
  <span class="a-dropdown-container"><select id="quantity" name="quantity" class="a-native-dropdown">
    <option>1</option><option>2</option></select><span class="a-dropdown-prompt">1</span></span><br><br>
  <!-- must stay hidden: tiny see-through checkbox, and a see-through button whose wrapper is invisible -->
  <input type="checkbox" aria-label="Tiny hidden checkbox" style="opacity:0;width:2px;height:2px">
  <span class="gone"><button style="opacity:0;width:120px;height:30px">Ghost button</button></span>
  <!-- plain visible control for reference -->
  <button>Visible button</button>
</body></html>`;

const { ctx, sw, page } = await launch();
await ctx.route("http://scanner-cases.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: PAGE }));
await page.goto("http://scanner-cases.test/");
await page.waitForTimeout(1500);
const scan = await sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ active: true });
  return chrome.tabs.sendMessage(t.id, { type: "POINTR_PREPARE_CAPTURE", turn: 1 });
});
await sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ active: true });
  return chrome.tabs.sendMessage(t.id, { type: "POINTR_ENDED" });
});
const labels = scan.elements.map((e) => `${e.role}:${e.label}`);
console.log(labels.join("\n"));
const want = ["button:Add to cart", "button:Buy Now", "combobox:Quantity:", "button:Visible button"];
const never = ["Tiny hidden checkbox", "Ghost button"];
let ok = true;
for (const w of want) if (!labels.includes(w)) { ok = false; console.log("MISSING", w); }
for (const n of never) if (labels.some((l) => l.includes(n))) { ok = false; console.log("SHOULD BE HIDDEN", n); }
console.log(ok ? "PASS scanner cases" : "FAIL scanner cases");
await ctx.close();
process.exit(ok ? 0 : 1);
