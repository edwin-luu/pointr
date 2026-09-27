import type http from "node:http";

// POST /transcribe (ARCHITECTURE 6.2): raw audio bytes (audio/webm) in,
// { ok, text, latencyMs } out. Forwards to the local Whisper container.
// Audio is never written to disk.

const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:8790";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export type TranscribeResponse = { ok: true; text: string; latencyMs: number } | { ok: false; error: string };

// Error strings the extension turns into friendly widget text.
export const VOICE_ERRORS = {
  down: "voice_helper_down",
  timeout: "voice_timeout",
  tooLarge: "audio_too_large",
  empty: "audio_empty",
} as const;

async function readAudio(req: http.IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_AUDIO_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function transcribe(audio: Buffer): Promise<TranscribeResponse> {
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(`${WHISPER_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, error: timedOut ? VOICE_ERRORS.timeout : VOICE_ERRORS.down };
  }
  if (!res.ok) return { ok: false, error: `whisper_http_${res.status}` };
  const body = (await res.json()) as { text?: string };
  return { ok: true, text: (body.text || "").trim(), latencyMs: Date.now() - start };
}

export async function handleTranscribe(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const send = (status: number, body: TranscribeResponse) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const audio = await readAudio(req);
  if (!audio) {
    req.resume();
    return send(413, { ok: false, error: VOICE_ERRORS.tooLarge });
  }
  if (audio.length === 0) return send(400, { ok: false, error: VOICE_ERRORS.empty });
  const result = await transcribe(audio);
  if (result.ok) console.log(`transcribe ${result.latencyMs}ms "${result.text}"`);
  else console.log(`transcribe ERROR ${result.error}`);
  send(200, result);
}

// One line for the startup banner: is the Whisper container reachable?
export async function whisperStatus(): Promise<string> {
  try {
    const r = await fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(1500) });
    const h = (await r.json()) as { model?: string };
    return `whisper ${h.model || "?"} at ${WHISPER_URL}`;
  } catch {
    return `whisper NOT reachable at ${WHISPER_URL} (voice input off; cd server && docker compose up -d whisper)`;
  }
}
