import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const PUBLIC_DIR = path.join(__dirname, "public");

type Popups = { bank: number; pharmacy: number; grocery: number };

const DEFAULTS: Popups = { bank: 0.33, pharmacy: 0.4, grocery: 0.2 };

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

async function loadSettings(): Promise<Popups> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    const data = JSON.parse(raw) as { popups?: Partial<Popups> };
    return { ...DEFAULTS, ...data.popups };
  } catch {
    return { ...DEFAULTS };
  }
}

async function saveSettings(popups: Popups): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify({ popups }, null, 2));
}

function isValidChance(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

async function serveStatic(res: http.ServerResponse, urlPath: string): Promise<void> {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" }).end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
  }

  if (url.pathname === "/api/settings" && req.method === "GET") {
    const popups = await loadSettings();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ popups, defaults: DEFAULTS }));
    return;
  }

  if (url.pathname === "/api/settings" && req.method === "PUT") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    try {
      const parsed = JSON.parse(body || "{}") as { popups?: Partial<Record<keyof Popups, unknown>> };
      const p = parsed.popups;
      if (!p || !isValidChance(p.bank) || !isValidChance(p.pharmacy) || !isValidChance(p.grocery)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "popups.bank, popups.pharmacy and popups.grocery must each be a number between 0 and 1",
          }),
        );
        return;
      }
      const popups: Popups = {
        bank: round2(p.bank),
        pharmacy: round2(p.pharmacy),
        grocery: round2(p.grocery),
      };
      await saveSettings(popups);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ popups, defaults: DEFAULTS }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid JSON body" }));
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(res, url.pathname);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
}

server.listen(PORT, () => {
  console.log(`Pointr Demo Hub listening on http://localhost:${PORT}`);
});
