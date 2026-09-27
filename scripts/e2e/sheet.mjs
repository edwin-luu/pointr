// Contact sheet of screenshot crops for pixel review:
// node sheet.mjs <out.png> <cols> <file:x:y:w:h> ...   (each crop is labelled with its file name)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const [out, cols, ...specs] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const cells = specs.map((s) => {
  const [file, x, y, w, h] = s.split(":");
  const b64 = fs.readFileSync(file).toString("base64");
  return `<figure style="margin:0"><figcaption style="font:12px sans-serif;margin:2px 0">${path.basename(file)}</figcaption>
    <div style="position:relative;overflow:hidden;width:${w}px;height:${h}px;outline:1px solid #999">
    <img style="position:absolute;left:${-x}px;top:${-y}px" src="data:image/png;base64,${b64}"></div></figure>`;
});
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: path.join(HERE, ".libs/usr/lib/x86_64-linux-gnu") } });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.setContent(`<body style="margin:8px;background:#fff"><div style="display:grid;grid-template-columns:repeat(${cols},max-content);gap:10px">${cells.join("")}</div></body>`);
await page.screenshot({ path: out, fullPage: true });
console.log(out);
await browser.close();
