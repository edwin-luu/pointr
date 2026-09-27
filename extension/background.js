import { getSession } from "./sw/session.js";
import {
  startSession,
  stopSession,
  runTurn,
  recordOutcome,
  handleHello,
  handleReady,
  answerCheckin,
  followNewTab,
  currentTabFor,
} from "./sw/loop.js";
import { toggleVoice, forgetTab } from "./sw/voice.js";

function log(...args) {
  console.log("[Pointr:sw]", ...args);
}

function logFailure(what) {
  return (err) => console.error(`[Pointr:sw] ${what} failed`, err);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return false;

  switch (message.type) {
    case "POINTR_START": {
      sendResponse({ ok: true });
      startSession(tabId, message.goal).catch((err) => {
        logFailure("startSession")(err);
        chrome.tabs.sendMessage(tabId, {
          type: "POINTR_ERROR",
          message: "Something went wrong starting Pointr.",
          retryable: false,
        });
      });
      return false;
    }

    case "POINTR_HELLO": {
      handleHello(tabId)
        .then(({ summary, resume }) => {
          sendResponse({ session: summary });
          if (summary) log(`hello from tab ${tabId} (${summary.status}, t${summary.turn})`);
          return resume();
        })
        .catch((err) => {
          logFailure("POINTR_HELLO")(err);
          sendResponse({ session: null });
        });
      return true; // async response
    }

    case "POINTR_STEP_RESULT": {
      sendResponse({ ok: true });
      recordOutcome(currentTabFor(tabId), message.turn, message.outcome).catch(logFailure("POINTR_STEP_RESULT"));
      return false;
    }

    case "POINTR_READY": {
      sendResponse({ ok: true });
      handleReady(tabId, message.turn).catch(logFailure("POINTR_READY"));
      return false;
    }

    case "POINTR_STOP": {
      sendResponse({ ok: true });
      stopSession(tabId).catch(logFailure("POINTR_STOP"));
      return false;
    }

    case "POINTR_RETRY": {
      sendResponse({ ok: true });
      getSession(tabId)
        .then((s) => (s ? runTurn(tabId) : null))
        .catch(logFailure("POINTR_RETRY"));
      return false;
    }

    case "POINTR_CHECKIN_ANSWER": {
      sendResponse({ ok: true });
      answerCheckin(tabId, !!message.keepGoing).catch(logFailure("POINTR_CHECKIN_ANSWER"));
      return false;
    }

    case "POINTR_VOICE_TOGGLE": {
      sendResponse({ ok: true });
      toggleVoice(tabId).catch(logFailure("POINTR_VOICE_TOGGLE"));
      return false;
    }

    default:
      log("not implemented yet:", message.type);
      return false;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-voice") return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    chrome.tabs.sendMessage(activeTab.id, { type: "POINTR_TOGGLE_VOICE" }, () => void chrome.runtime.lastError);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => forgetTab(tabId));

// A link on the guided page opened a new tab: guidance follows the user there.
chrome.tabs.onCreated.addListener((tab) => {
  followNewTab(tab).catch(logFailure("followNewTab"));
});

// First install: the welcome tab asks for the microphone once.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: "welcome/welcome.html" });
});

log("service worker started");
