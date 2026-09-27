// Offscreen recorder (ARCHITECTURE 13, 6.3): the microphone permission belongs
// to the extension (granted once on the welcome tab), so no site ever asks.
// OFFSCREEN_RECORD_START -> getUserMedia + MediaRecorder (webm/opus).
// OFFSCREEN_RECORD_STOP -> stop, release the mic, POST the audio to the
// backend's /transcribe, reply with the text.
const TRANSCRIBE_URL = "http://localhost:8787/transcribe";
const MIN_BYTES = 1500; // shorter than this is a click, not speech

let stream = null;
let recorder = null;
let chunks = [];

function releaseMic() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
}

async function start() {
  if (recorder) return { ok: true };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") return { ok: false, error: "mic_denied" };
    if (name === "NotFoundError" || name === "OverconstrainedError") return { ok: false, error: "no_mic" };
    return { ok: false, error: String(name || err) };
  }
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.start(250);
  return { ok: true };
}

async function stop() {
  if (!recorder) return { ok: false, error: "not_recording" };
  const r = recorder;
  recorder = null;
  await new Promise((resolve) => {
    r.onstop = resolve;
    r.stop();
  });
  releaseMic();
  const blob = new Blob(chunks, { type: "audio/webm" });
  chunks = [];
  if (blob.size < MIN_BYTES) return { ok: true, text: "" };
  try {
    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    return body.ok ? { ok: true, text: body.text } : { ok: false, error: body.error };
  } catch {
    return { ok: false, error: "backend_down" };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return false;
  const run = message.type === "OFFSCREEN_RECORD_START" ? start
    : message.type === "OFFSCREEN_RECORD_STOP" ? stop
    : null;
  if (!run) return false;
  run().then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});
