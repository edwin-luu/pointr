// Zooms into part of a screenshot for pixel checks: node crop.mjs <png> <x> <y> <w> <h> [scale=2] [out]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const [file, x, y, w, h, scale = "2", out] = process.argv.slice(2);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: path.join(HERE, ".libs/usr/lib/x86_64-linux-gnu") } });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
const b64 = fs.readFileSync(file).toString("base64");
await page.setContent(`<body style="margin:0;overflow:hidden"><img style="position:absolute;left:${-x}px;top:${-y}px;image-rendering:auto" src="data:image/png;base64,${b64}"></body>`);
const dest = out || file.replace(/\.png$/, `-crop.png`);
await page.screenshot({ path: dest });
console.log(dest);
await browser.close();
