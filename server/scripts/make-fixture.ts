// Copies one logged turn into a bake-off fixture.
// Usage: node scripts/make-fixture.ts <logFolder> <name> [acceptableIds...]
//          [--action click|type|scroll|info|show] [--done] [--note "why these ids"]
//          [--also action:id,id]   (repeatable: another answer that is just as good)
// Writes server/fixtures/<name>/{request.json, screenshot.jpg, expected.json}.
// --action defaults to "click" when ids are given, else "info".
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const positional: string[] = [];
const flags: Record<string, string | true> = {};
const also: string[] = []; // --also "click:14" (repeatable): another acceptable action:ids answer
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--done") flags.done = true;
  else if (a === "--also") also.push(argv[++i]);
  else if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
  else positional.push(a);
}
const [logArg, name, ...idArgs] = positional;
if (!logArg || !name) {
  console.error('Usage: node scripts/make-fixture.ts <logFolder> <name> [ids...] [--action a] [--done] [--note "..."]');
  process.exit(1);
}

const serverDir = path.resolve(import.meta.dirname, "..");
const logDir = path.isAbsolute(logArg) || logArg.includes("/") ? path.resolve(logArg) : path.join(serverDir, "logs", logArg);
const outDir = path.join(serverDir, "fixtures", name);
const acceptableIds = idArgs.map(Number);
if (acceptableIds.some((n) => !Number.isInteger(n))) throw new Error(`ids must be integers: ${idArgs.join(" ")}`);
const action = (flags.action as string) || (acceptableIds.length ? "click" : "info");

const request = JSON.parse(await readFile(path.join(logDir, "request.json"), "utf8"));
for (const id of acceptableIds) {
  const el = request.elements.find((e: { id: number }) => e.id === id);
  if (!el) throw new Error(`id ${id} is not in ${logDir}/request.json`);
  console.log(`  #${id} ${el.role} "${el.label}"`);
}
request.sessionId = `fixture-${name}`;

await mkdir(outDir, { recursive: true });
await copyFile(path.join(logDir, "screenshot.jpg"), path.join(outDir, "screenshot.jpg"));
await writeFile(path.join(outDir, "request.json"), JSON.stringify(request, null, 2) + "\n");
const expected: Record<string, unknown> = { acceptableIds, action };
if (flags.done) expected.done = true;
if (also.length) {
  expected.alsoOk = also.map((spec) => {
    const [a, ids = ""] = spec.split(":");
    return { action: a, acceptableIds: ids.split(",").filter(Boolean).map(Number) };
  });
}
expected.note = (flags.note as string) || "";
expected.source = path.basename(logDir);
await writeFile(path.join(outDir, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
console.log(`fixture ${name}: goal "${request.goal}", expect ${action} ${JSON.stringify(acceptableIds)}${flags.done ? " done" : ""}`);
