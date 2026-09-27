// One-time microphone permission for the extension origin (ARCHITECTURE 13):
// after this, the offscreen recorder can use the mic on every website.
const $ = (id) => document.getElementById(id);

function show(which) {
  $("ok").classList.toggle("on", which === "ok");
  $("bad").classList.toggle("on", which === "bad");
  $("allow").hidden = which === "ok";
}

async function showShortcut() {
  const commands = await chrome.commands.getAll();
  const voice = commands.find((c) => c.name === "toggle-voice");
  if (voice && voice.shortcut) {
    $("key").textContent = voice.shortcut;
  } else {
    $("okText").textContent =
      "Microphone allowed. Set a keyboard shortcut for \"Talk to Pointr\" on the page that just opened (Alt+X is suggested).";
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
}

async function allow() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of stream.getTracks()) t.stop();
    show("ok");
    showShortcut();
  } catch (err) {
    $("badText").textContent =
      err && err.name === "NotFoundError"
        ? "No microphone was found. Connect one and try again."
        : "The microphone is blocked for Pointr.";
    show("bad");
  }
}

$("allow").addEventListener("click", allow);
$("settings").addEventListener("click", () => {
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` });
});

// Already allowed (e.g. reopened later): say so right away.
navigator.permissions.query({ name: "microphone" }).then((p) => {
  if (p.state === "granted") { show("ok"); showShortcut(); }
  else if (p.state === "denied" || new URLSearchParams(location.search).get("mic") === "denied") show("bad");
});
