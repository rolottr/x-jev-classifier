// X Jev Classifier options: saves settings to local storage. No server involved.

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.local.get([
    "apiKey", "model", "enabled", "feedEnabled", "sentimentEnabled",
  ]);
  const legacyEnabled = s.enabled !== false;
  $("apiKey").value = s.apiKey || "";
  $("model").value = s.model || "jev-latest";
  $("feedEnabled").checked = s.feedEnabled === undefined
    ? legacyEnabled : s.feedEnabled !== false;
  $("sentimentEnabled").checked = s.sentimentEnabled === undefined
    ? legacyEnabled : s.sentimentEnabled !== false;
}

$("save").addEventListener("click", async () => {
  const apiKey = $("apiKey").value.trim();
  const model = $("model").value.trim() || "jev-latest";
  const feedEnabled = $("feedEnabled").checked;
  const sentimentEnabled = $("sentimentEnabled").checked;
  // Keep the old key for older unpacked copies. New code uses the two
  // specific switches above.
  await chrome.storage.local.set({
    apiKey, model, feedEnabled, sentimentEnabled,
    enabled: feedEnabled,
  });
  $("status").textContent = apiKey
    ? "Saved. Settings applied."
    : "Saved without a key. Analysis will stay idle.";
  setTimeout(() => ($("status").textContent = ""), 4000);
});

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ xbcache: {} });
  $("status").textContent = "Cache cleared. Reload the X tab.";
  setTimeout(() => ($("status").textContent = ""), 4000);
});

load();
