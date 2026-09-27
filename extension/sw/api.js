const BASE_URL = "http://localhost:8787";
// Worst case on the server is a parse retry plus a validation retry plus a
// Bedrock->Gemini fallback (15 s timeout each), so leave headroom.
const TIMEOUT_MS = 30_000;

export async function requestNextStep(req) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}/next-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    return await res.json();
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, error: "Pointr's helper server took too long to respond", retryable: true };
    }
    if (res) {
      console.error("[Pointr:sw] /next-step returned non-JSON", res.status, err);
      return { ok: false, error: `Pointr's helper server had a problem (HTTP ${res.status})`, retryable: true };
    }
    return { ok: false, error: "Pointr's helper server is not running", retryable: true };
  } finally {
    clearTimeout(timeout);
  }
}
