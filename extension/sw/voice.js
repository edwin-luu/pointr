// Push-to-talk (ARCHITECTURE 13): Alt+X or the mic button toggles recording
// in the offscreen document; the text goes back to the tab's widget, which
// fills the goal box and sends it. One recording at a time (one microphone).
const OFFSCREEN_URL = "offscreen/offscreen.html";
const MAX_RECORD_MS = 30_000; // safety cap, no silence detection
const KEEPALIVE_MS = 20_000; // an extension API call resets the SW idle timer

let recording = null; // { tabId, capTimer, keepAlive }
let transcribingTab = null;
let creating = null; // in-flight createDocument

function log(...args) {
  console.log("[Pointr:sw]", ...args);
}

function toTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => void chrome.runtime.lastError);
}

function voiceState(tabId, state, extra = {}) {
  toTab(tabId, { type: "POINTR_VOICE_STATE", state, ...extra });
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["USER_MEDIA"],
        justification: "Record the user's spoken goal for Pointr (push-to-talk).",
      })
      .finally(() => (creating = null));
  }
  await creating;
}

function toOffscreen(type) {
  return chrome.runtime.sendMessage({ target: "offscreen", type }).catch((err) => ({ ok: false, error: String(err) }));
}

// Friendly widget text for an error code from the offscreen doc / backend.
function friendly(error) {
  switch (error) {
    case "mic_denied": return "Please allow the microphone in the new tab.";
    case "no_mic": return "I can't find a microphone. Check that one is connected.";
    case "voice_helper_down": return "Voice helper isn't running";
    case "voice_timeout": return "The voice helper took too long. Try again.";
    case "backend_down": return "Pointr's helper server is not running";
    default: return "Voice input had a problem. Try again, or type instead.";
  }
}

async function start(tabId) {
  try {
    await ensureOffscreen();
  } catch (err) {
    log("offscreen document failed", err);
    voiceState(tabId, "error", { error: friendly("offscreen") });
    return;
  }
  const reply = await toOffscreen("OFFSCREEN_RECORD_START");
  if (!reply || !reply.ok) {
    const error = reply ? reply.error : "no_reply";
    log(`voice start failed: ${error}`);
    if (error === "mic_denied") chrome.tabs.create({ url: "welcome/welcome.html?mic=denied" });
    voiceState(tabId, "error", { error: friendly(error) });
    return;
  }
  recording = {
    tabId,
    capTimer: setTimeout(() => stop(tabId), MAX_RECORD_MS),
    keepAlive: setInterval(() => chrome.runtime.getPlatformInfo(() => {}), KEEPALIVE_MS),
  };
  log(`voice recording in tab ${tabId}`);
  voiceState(tabId, "recording");
}

async function stop(tabId) {
  if (!recording || recording.tabId !== tabId) return;
  clearTimeout(recording.capTimer);
  clearInterval(recording.keepAlive);
  recording = null;
  transcribingTab = tabId;
  voiceState(tabId, "transcribing");
  const t0 = Date.now();
  const reply = await toOffscreen("OFFSCREEN_RECORD_STOP");
  transcribingTab = null;
  if (reply && reply.ok) {
    log(`voice text in ${Date.now() - t0} ms: "${reply.text}"`);
    voiceState(tabId, "idle", { text: reply.text || "" });
  } else {
    const error = reply ? reply.error : "no_reply";
    log(`voice stop failed: ${error}`);
    voiceState(tabId, "error", { error: friendly(error) });
  }
}

// POINTR_VOICE_TOGGLE from a tab (mic button, or Alt+X relayed by content).
export async function toggleVoice(tabId) {
  if (transcribingTab != null) return; // busy; the answer is on its way
  if (recording) {
    // A second press anywhere stops the one recording (it belongs to its tab).
    await stop(recording.tabId);
    return;
  }
  await start(tabId);
}

// The tab went away mid-recording: stop and drop the result.
export function forgetTab(tabId) {
  if (recording && recording.tabId === tabId) {
    clearTimeout(recording.capTimer);
    clearInterval(recording.keepAlive);
    recording = null;
    toOffscreen("OFFSCREEN_RECORD_STOP");
  }
}
