// X Jev Classifier content script: watches the feed, marks posts. Never hides them.
// Quoted-post text is captured and sent along as context; the quoted text
// itself does not get its own badge.

const MAX_ACTIVE = 3;
const queue = [];
let active = 0;
let marked = 0;
let chipWarned = false;
let feedEnabled = null;

// One color per archetype. Used for the pill tint and the solid hover fill.
const TYPE_COLORS = {
  alpha: "#1d9bf0",
  shitpost: "#b8860b",
  ai_slop: "#7856ff",
  shill: "#f4b400",
  pump: "#00ba7c",
  scam: "#f4212e",
  money_flex: "#ffd400",
  data: "#00b8d9",
  bait: "#ff7a00",
  rage: "#d63031",
  announce: "#17bf63",
  news: "#8899a6",
  question: "#71c9f8",
  wholesome: "#f91880",
  callout: "#ff6b6b",
  creative: "#9b59b6",
  story: "#5c7cfa",
  nothing: "#6b7280",
};

const VERDICT_TEXT = { hazmat: "☣️ HAZMAT", sus: "👀 SUS" };

function makeChip() {
  if (document.getElementById("xb-chip")) return;
  const chip = document.createElement("div");
  chip.id = "xb-chip";
  chip.innerHTML = '<span class="xb-ninja">🥷</span><span>X Jev:</span><b class="xb-count">0</b>';
  document.body.appendChild(chip);
}

function setChipCount(n) {
  const c = document.querySelector("#xb-chip .xb-count");
  if (c) c.textContent = String(n);
}

function setChipWorking(on) {
  const chip = document.getElementById("xb-chip");
  if (chip) chip.classList.toggle("xb-working", on);
}

function setChipNote(text) {
  const chip = document.getElementById("xb-chip");
  if (chip && text) chip.innerHTML = `<span class="xb-ninja">🥷</span><span>${text}</span>`;
}

function setChipVisible(on) {
  const chip = document.getElementById("xb-chip");
  if (chip) chip.hidden = !on;
}

function bar(frac, hot) {
  return `<div class="xb-bar"><i class="${hot ? "hot" : ""}" style="width:${frac}%"></i></div>`;
}

function tooltipHtml(t) {
  let rows = '<div class="xb-tt-title">TYPE READ</div>';
  for (const r of t.types) {
    rows += `<div class="xb-row"><span class="xb-name">${r.icon} ${r.label}</span>${bar(r.frac)}</div>`;
  }
  if (t.signals.length) {
    rows += '<div class="xb-tt-title">SIGNALS</div>';
    for (const r of t.signals) {
      rows += `<div class="xb-row"><span class="xb-name">${r.icon} ${r.label}</span>${bar(r.frac, r.hot)}</div>`;
    }
  }
  rows += '<div class="xb-tt-title">LEVELS</div>';
  for (const r of t.levels) {
    rows += `<div class="xb-row"><span class="xb-name">${r.icon} ${r.label}</span>${bar(r.frac, r.hot)}</div>`;
  }
  return rows;
}

// The tooltip lives in a fixed layer on document.body, so X's images and
// stacking contexts can never paint over it.
let tipEl = null;

function hideTip() {
  if (tipEl) {
    tipEl.remove();
    tipEl = null;
  }
}

function attachTip(el, html) {
  el.addEventListener("mouseenter", () => {
    hideTip();
    const tip = document.createElement("div");
    tip.className = "xb-tip-fixed";
    tip.innerHTML = html;
    document.body.appendChild(tip);
    const w = 340;
    const h = tip.offsetHeight;
    const rect = el.getBoundingClientRect();
    let left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8));
    // prefer opening up; fall back down when there is no room above
    let top = rect.top - h - 8;
    if (top < 8) {
      top = rect.bottom + 8;
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.addEventListener("mouseleave", hideTip);
    tipEl = tip;
  });
  el.addEventListener("mouseleave", () => {
    // keep the tip if the pointer moved into it
    setTimeout(() => {
      if (tipEl && !tipEl.matches(":hover") && !el.matches(":hover")) hideTip();
    }, 60);
  });
}

window.addEventListener("scroll", hideTip, { passive: true, capture: true });

function badge(result) {
  const color = TYPE_COLORS[result.pick] || "#6b7280";
  const el = document.createElement("div");
  el.className = "xb-badge";
  el.innerHTML =
    `<span class="xb-type" style="--xb-c:${color}">${result.icon} ${result.label}</span>` +
    (result.verdict !== "clean"
      ? `<span class="xb-v xb-v-${result.verdict}">${VERDICT_TEXT[result.verdict]}</span>`
      : "");
  attachTip(el, tooltipHtml(result.tooltip));
  return el;
}

function enqueue(tweetEl, quote) {
  queue.push({ tweetEl, quote });
  pump();
}

function pump() {
  const working = active > 0 || queue.length > 0;
  setChipWorking(working);
  while (active < MAX_ACTIVE && queue.length) {
    active++;
    const job = queue.shift();
    mark(job.tweetEl, job.quote).finally(() => {
      active--;
      pump();
    });
  }
}

async function mark(el, quote) {
  // read the text BEFORE inserting the badge, so the badge words never leak in
  if (feedEnabled !== true) return;
  const text = (el.innerText || "").trim().slice(0, 2000);
  if (!text) return;
  let res;
  try {
    res = await chrome.runtime.sendMessage({ type: "classify", text, quote });
  } catch (e) {
    return;
  }
  if (!res || res.error) {
    if (res && res.error === "no-key" && !chipWarned) {
      chipWarned = true;
      setChipNote("X Jev: add your API key");
    }
    el.removeAttribute("data-xb"); // allow retry later
    return;
  }
  if (feedEnabled !== true) return;
  el.classList.add("xb-host");
  el.insertBefore(badge(res.result), el.firstChild);
  marked++;
  setChipCount(marked);
}

// A tweet article can contain several tweetText divs: the first is the post
// itself, the rest belong to the quoted/embedded post. Only the first gets a
// badge; the quoted text is sent along as context for the classifier.
const markedArticles = new WeakSet();

function quoteTextFor(article, mainEl) {
  const parts = [];
  article.querySelectorAll('div[data-testid="tweetText"]').forEach((t) => {
    if (t === mainEl) return;
    const txt = (t.innerText || "").trim();
    if (txt) parts.push(txt.slice(0, 800));
  });
  return parts.join("\n—\n").slice(0, 1200);
}

function scan() {
  if (feedEnabled !== true) return;
  makeChip();
  document.querySelectorAll('div[data-testid="tweetText"]').forEach((el) => {
    if (el.dataset.xb) return;
    const article = el.closest("article");
    if (article) {
      if (markedArticles.has(article)) return; // quoted text: context only
      markedArticles.add(article);
      el.dataset.xb = "1";
      enqueue(el, quoteTextFor(article, el));
    } else {
      el.dataset.xb = "1";
      enqueue(el, "");
    }
  });
}

let timer = null;
const observer = new MutationObserver(() => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(scan, 400);
});

function applyFeedEnabled(on) {
  feedEnabled = on;
  setChipVisible(on);
  if (!on) {
    queue.length = 0;
    setChipWorking(false);
  } else {
    scan();
  }
}

async function loadFeedEnabled() {
  const s = await chrome.storage.local.get(["enabled", "feedEnabled"]);
  const legacyEnabled = s.enabled !== false;
  applyFeedEnabled(s.feedEnabled === undefined
    ? legacyEnabled : s.feedEnabled !== false);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || (!changes.feedEnabled && !changes.enabled)) return;
  loadFeedEnabled();
});

makeChip();
observer.observe(document.body, { childList: true, subtree: true });
loadFeedEnabled();
