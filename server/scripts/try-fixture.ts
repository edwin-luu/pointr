// Replays one fixture (request.json + screenshot.jpg) against the running
// backend, whichever provider it is configured for.
// Usage: npm run try <fixtureDir> [goal]
import { readFile } from "node:fs/promises";
import path from "node:path";

const [, , fixtureDirArg, goalOverride] = process.argv;

if (!fixtureDirArg) {
  console.error("Usage: npm run try <fixtureDir> [goal]");
  process.exit(1);
}

const fixtureDir = path.resolve(fixtureDirArg);
const requestJson = JSON.parse(await readFile(path.join(fixtureDir, "request.json"), "utf8"));
const screenshot = (await readFile(path.join(fixtureDir, "screenshot.jpg"))).toString("base64");

const body = {
  ...requestJson,
  goal: goalOverride ?? requestJson.goal,
  screenshot,
};

const port = process.env.PORT || 8787;

const start = Date.now();
const res = await fetch(`http://localhost:${port}/next-step`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const latency = Date.now() - start;
const json = await res.json();

const via = json.ok ? `  Provider: ${json.provider} (${json.model})` : "";
console.log(`Status: ${res.status}  Round-trip: ${latency}ms${via}`);
console.log(JSON.stringify(json, null, 2));
