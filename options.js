// X Jev Classifier options: saves the API key to local storage. No server involved.

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.local.get(["apiKey", "model", "enabled"]);
  $("apiKey").value = s.apiKey || "";
  $("model").value = s.model || "jev-latest";
  $("enabled").checked = s.enabled !== false;
}

$("save").addEventListener("click", async () => {
  const apiKey = $("apiKey").value.trim();
  const model = $("model").value.trim() || "jev-latest";
  const enabled = $("enabled").checked;
  await chrome.storage.local.set({ apiKey, model, enabled });
  $("status").textContent = apiKey ? "Saved. Reload the X tab." : "Saved without a key. X Jev Classifier will stay idle.";
  setTimeout(() => ($("status").textContent = ""), 4000);
});

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ xbcache: {} });
  $("status").textContent = "Cache cleared. Reload the X tab.";
  setTimeout(() => ($("status").textContent = ""), 4000);
});

load();
