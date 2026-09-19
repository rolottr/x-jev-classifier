// X Jev Classifier — composer tag panel wiring (content script).
//
// Reads the draft you are typing and shows a 3x2 tag grid inside the
// composer container, above the composer footer. It NEVER clicks, posts,
// replies or touches any X control: the only X element it reads is the
// editor's text. Tiles are built with createElement/textContent only.
//
// Two modes share the same slot: MEME (the classifier's 15 questions,
// tags SHITPOST/BAIT/CRINGE/SHILLING/PUMP/RAGE as a 100-point
// distribution) and NORMIE (the merged 50-question set; the labels
// EMOTION/CONVERSATION/SHARE/TIMELY/CRAFT/IDENTITY each score 0..100 on
// their own — no shared total, see composer-analysis.js). One segmented
// switch — a single semantic role="switch" button with internal labels,
// 🚀 NORMIE on the left, 🤮 MEME on the right — sits at the top-right,
// above the six bars. The choice is saved to chrome.storage.local as
// analysisMode; MEME is the default, so existing users stay on MEME.
// Switching the mode invalidates the in-flight reply at once, drops the
// current bars for a small spinner and re-reads the current draft; when
// the new mode's reply lands, fresh bars rise from zero to their result
// widths. The switch stays visible throughout. The grid, its tiles and
// the switch are built once per result and never replaced by a later
// result in the same mode: only bar widths, ARIA values and the tile
// emoji + names change in place while typing.
//
// NORMIE evidence: below the six bars (NORMIE only) sits the evidence list
// for the hovered or focused label — green means a positive point, red
// means a penalty, and grey means the point does not apply. Hovering or
// focusing another label replaces the list in place; leaving the
// grid/evidence area collapses it. MEME never builds it.
//
// Empty draft: the whole analyzer panel (switch, bars, evidence) stays
// collapsed; the first successful result expands it.
//
// Live X DOM contract (stable selectors, no hashed classes, no <form> —
// the composer has none):
//   editor:  div[data-testid="tweetTextarea_0"][role="textbox"]
//            (contenteditable, aria-label "Post text")
//   host:    the nearest DIV ancestor of the editor that also contains a
//            post/reply button (button[data-testid="tweetButtonInline"] on
//            the home composer, button[data-testid="tweetButton"] or the
//            reply equivalent in modals). Its direct children are the
//            editor area and a footer holding the toolbar and that button.
//   place:   the panel is inserted immediately before the footer child:
//            below the editor area, above the toolbar, outside the
//            Draft.js editor subtree, so the textbox and its text always
//            stay intact.
//
// Staleness: input is debounced ~800 ms; every keystroke — and every
// mode switch — invalidates every in-flight reply through a token gate,
// and the background aborts the previous in-flight request for the tab,
// so a result can never replace the text you are looking at now.

(function () {
  const Q = globalThis.XJevComposerQuestions;
  const A = globalThis.XJevComposerAnalysis;
  if (!Q || !A) return; // modules missing: stay silent, feed classifier unaffected

  const DEBOUNCE_MS = A.DEBOUNCE_MS;
  const MAX_TEXT = 2000; // same cap the feed classifier uses
  const EDITOR_SEL = 'div[data-testid="tweetTextarea_0"][role="textbox"]';
  const BUTTON_SEL = [
    'button[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButton"]',
    'button[data-testid="replyButton"]',
  ].join(",");

  let editor = null; // active editor element
  let panel = null;  // the single panel element, moved between composers
  let slot = null;   // panel child holding the status line or the grid
  let modeRow = null; // { row, sw }: the switch, built once
  let ui = null;     // { grid, tiles: [{node, fill, name}], ev, mode }
  let timer = null;  // debounce timer
  const gate = A.staleGate(); // in-flight replies must still be current
  let sentimentEnabled = null;
  let mode = "meme"; // "meme" | "normie"; persisted as analysisMode, default MEME
  let modeLoading = false; // a mode change dropped the bars and waits for its reply
  let currentNorm = null; // latest NORMIE result's normalized answers (evidence reads it)
  let shownOnce = false; // the panel has expanded at least once

  // One animation frame in a browser; synchronous where frames do not
  // exist (the Node harness without a frame stub), so deferred work
  // degrades to an instant update instead of hanging.
  const nextFrame = typeof requestAnimationFrame === "function"
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => fn();

  function editors() {
    return Array.from(document.querySelectorAll(EDITOR_SEL)).filter((el) => el.isConnected);
  }

  function pickEditor(cands) {
    if (!cands.length) return null;
    if (editor && cands.includes(editor)) return editor;
    // prefer an editor that already holds a draft (reopened composer)
    const withText = cands.find((el) => readDraft(el));
    return withText || cands[0];
  }

  // X can leave a newline, non-breaking space or zero-width marker in an
  // empty contenteditable. Treat all of those as empty so the analyzer is
  // removed as soon as the user clears the draft.
  function readDraft(el) {
    return (el && el.innerText || "")
      .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
  }

  function makePanel() {
    const el = document.createElement("div");
    el.id = "xjc-panel";
    el.className = "xjc-panel";
    el.setAttribute("aria-live", "polite");
    const body = document.createElement("div");
    body.className = "xjc-body";
    slot = document.createElement("div");
    slot.className = "xjc-slot";
    body.append(makeModeRow(), slot); // the switch sits above, top-right
    el.append(body);
    el.hidden = true; // empty draft: fully collapsed until the first result
    return el;
  }

  // The mode control: ONE compact segmented switch, not two standalone
  // buttons. A single button carries role="switch" (aria-checked true
  // means NORMIE, false means MEME) and two internal labels: 🚀 NORMIE on
  // the left, 🤮 MEME on the right. Built once with the panel; only
  // its aria-checked state ever changes.
  function makeModeRow() {
    const row = document.createElement("div");
    row.className = "xjc-mode";
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "xjc-switch";
    sw.id = "xjc-mode-switch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", "Analysis mode: NORMIE or MEME");
    const opt = (m, label) => {
      const s = document.createElement("span");
      s.className = "xjc-opt xjc-opt-" + m;
      s.textContent = label;
      return s;
    };
    sw.append(opt("normie", "🚀 NORMIE"), opt("meme", "🤮 MEME"));
    sw.addEventListener("click", () => selectMode(mode === "normie" ? "meme" : "normie"));
    modeRow = { row, sw };
    row.append(sw);
    syncModeUi();
    return row;
  }

  // Reflect the current mode in the switch state and, when a grid is
  // still attached (a dormant one behind a hidden panel), in the tile
  // names, emojis and meter labels. No node is replaced.
  function syncModeUi() {
    if (modeRow) {
      modeRow.sw.setAttribute("aria-checked", String(mode === "normie"));
    }
    if (ui && ui.grid.isConnected) {
      const meta = A.tileMeta(mode);
      ui.tiles.forEach((ref, i) => {
        ref.name.textContent = meta[i].emoji + " " + meta[i].label;
        ref.node.setAttribute("aria-label", meta[i].label);
      });
    }
  }

  function selectMode(m) {
    if (m === mode) return;
    mode = m;
    const saving = chrome.storage.local.set({ analysisMode: m });
    if (saving && typeof saving.catch === "function") saving.catch(() => {});
    syncModeUi();
    // invalidate the in-flight reply at once, then re-read the draft
    resetPending();
    if (sentimentEnabled === true && editor && editor.isConnected
        && readDraft(editor)) {
      placePanel();
      beginModeLoad(); // bars out, spinner in, switch stays visible
      schedule();
    }
  }

  // The composer host is the nearest ancestor of the editor that contains
  // the composer's own post/reply button. Within that host, the footer is
  // the direct child that contains the button (toolbar + Post/Reply row).
  // The panel sits immediately before the footer: below the editor area,
  // above the toolbar, never inside the Draft.js/editor subtree, so the
  // textbox and its text always stay intact. Re-running this after a
  // rerender re-attaches the same element and strays are swept, so no
  // duplicates pile up. If no safe host/footer is found, fail quiet.
  function placePanel() {
    if (!editor || !editor.isConnected) return;
    let host = editor.parentElement;
    while (host && host !== document.body && !host.querySelector(BUTTON_SEL)) {
      host = host.parentElement;
    }
    if (!host || host === document.body) return; // no composer host: fail quiet
    if (editor.contains(host)) return; // never place relative to the editor subtree
    const btn = host.querySelector(BUTTON_SEL);
    let footer = btn;
    while (footer && footer.parentElement !== host) footer = footer.parentElement;
    if (!footer || footer.contains(editor)) return; // no safe footer: fail quiet
    if (!panel) panel = makePanel();
    for (const stray of document.querySelectorAll("div#xjc-panel")) {
      if (stray !== panel) stray.remove();
    }
    if (panel.parentElement !== host || panel.nextElementSibling !== footer) {
      host.insertBefore(panel, footer);
    }
  }

  function hidePanel() {
    if (panel) panel.hidden = true;
    currentNorm = null;
  }

  function resetPending() {
    if (timer) clearTimeout(timer);
    timer = null;
    modeLoading = false; // any pending mode-change load is now moot
    gate.bump(); // invalidate any in-flight reply
  }

  function statusNode(text, isError) {
    const d = document.createElement("div");
    d.className = "xjc-status" + (isError ? " xjc-error" : "");
    d.textContent = text;
    return d;
  }

  function setStatus(text, isError) {
    if (!panel || !slot) return;
    modeLoading = false; // a status line ends any mode-change load
    shownOnce = true; // a status line (reading, error) expands the panel
    panel.hidden = false;
    slot.replaceChildren(statusNode(text, isError));
  }

  // A mode change swaps the six bars out for a small spinner at once.
  // The spinner holds the slot the bars left, centered in their place,
  // while the new mode's request runs; the switch above never moves.
  function spinnerNode() {
    const wrap = document.createElement("div");
    wrap.className = "xjc-load";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-label", "Loading the new mode");
    const dot = document.createElement("i");
    dot.className = "xjc-spinner";
    dot.setAttribute("aria-hidden", "true");
    wrap.append(dot);
    return wrap;
  }

  function beginModeLoad() {
    modeLoading = true;
    if (!panel || !slot) return;
    panel.hidden = false;
    slot.replaceChildren(spinnerNode());
  }

  // ==== NORMIE EVIDENCE LIST ====
  // Below the six NORMIE bars: the checks and penalties behind the hovered
  // or focused label, one label at a time. Wrapper,
  // title and list are built once with the grid; only the title text,
  // the aria-label and the list items ever change. MEME never builds it.
  function makeEvidence() {
    const wrap = document.createElement("div");
    wrap.className = "xjc-evidence";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Evidence");
    const title = document.createElement("div");
    title.className = "xjc-evidence-title";
    const list = document.createElement("ul");
    list.className = "xjc-evidence-list";
    wrap.append(title, list);
    wrap.hidden = true;
    return { wrap, title, list, active: -1 };
  }

  function evidenceItem(plus, text) {
    const li = document.createElement("li");
    const state = plus === null
      ? "xjc-ev-neutral"
      : (plus ? "xjc-ev-pos" : "xjc-ev-neg");
    li.className = "xjc-evidence-item " + state;
    const dot = document.createElement("i");
    dot.className = "xjc-dot";
    dot.setAttribute("aria-hidden", "true");
    const span = document.createElement("span");
    span.textContent = text;
    li.append(dot, span);
    return li;
  }

  function showEvidence(idx) {
    const ev = ui && ui.ev;
    if (!ev || !currentNorm) return;
    const meta = A.tileMeta("normie")[idx];
    if (!meta) return;
    ev.active = idx;
    ev.title.textContent = meta.emoji + " " + meta.label;
    ev.wrap.setAttribute("aria-label", "Evidence for " + meta.label);
    const items = A.normieEvidence(meta.id, currentNorm);
    if (items.length) {
      ev.list.replaceChildren(...items.map((it) => evidenceItem(it.plus, it.text)));
    } else {
      const li = document.createElement("li");
      li.className = "xjc-evidence-item xjc-ev-none";
      li.textContent = "No active evidence for this label.";
      ev.list.replaceChildren(li);
    }
    ev.wrap.hidden = false;
  }

  function hideEvidence() {
    const ev = ui && ui.ev;
    if (!ev) return;
    ev.active = -1;
    ev.wrap.hidden = true;
  }

  // Hover/focus rules: entering a tile shows that label at once;
  // entering another tile replaces the list in place; leaving the
  // grid/evidence area, or blurring the tiles, collapses it. A queued
  // hide waits one frame, so a move into a neighbouring tile or into
  // the evidence area itself cancels it.
  function wireEvidence(grid, refs, ev) {
    let hideQueued = false;
    const queueHide = () => {
      hideQueued = true;
      nextFrame(() => { if (hideQueued) hideEvidence(); });
    };
    const stay = () => { hideQueued = false; };
    refs.forEach((ref, i) => {
      ref.node.addEventListener("mouseenter", () => { stay(); showEvidence(i); });
      ref.node.addEventListener("focus", () => { stay(); showEvidence(i); });
      ref.node.addEventListener("blur", queueHide);
    });
    grid.addEventListener("mouseenter", stay);
    grid.addEventListener("mouseleave", queueHide);
    ev.wrap.addEventListener("mouseenter", stay);
    ev.wrap.addEventListener("mouseleave", queueHide);
  }

  // The grid is built when a result needs one and no matching grid is
  // attached (first result, after an error state, or after a mode change
  // dropped the old bars for the spinner); every later result in the
  // same mode only updates the existing fill widths and ARIA values in
  // place, so retyping never rebuilds the DOM the panel is showing. A
  // NORMIE grid also gets focusable tiles and the evidence list below the
  // bars. The switch lives outside the slot and survives every swap.
  function ensureGrid(slotEl, tiles) {
    if (ui && ui.grid.parentElement === slotEl && ui.mode === mode) return ui;
    const grid = document.createElement("div");
    grid.className = "xjc-grid";
    const refs = tiles.map((t) => {
      const tile = document.createElement("div");
      tile.className = "xjc-tile";
      tile.setAttribute("role", "meter");
      tile.setAttribute("aria-label", t.label);
      tile.setAttribute("aria-valuemin", "0");
      tile.setAttribute("aria-valuemax", "100");
      tile.setAttribute("aria-valuenow", "0");
      tile.setAttribute("aria-valuetext", "0 of 100 points");
      if (mode === "normie") tile.setAttribute("tabindex", "0"); // focus shows evidence
      const bar = document.createElement("span");
      bar.className = "xjc-tile-bar";
      bar.setAttribute("aria-hidden", "true");
      const fill = document.createElement("i");
      fill.style.width = "0%";
      fill.style.setProperty("--xjc-c", t.color);
      bar.append(fill);
      const name = document.createElement("span");
      name.className = "xjc-tile-name";
      name.setAttribute("aria-hidden", "true");
      name.textContent = t.emoji + " " + t.label;
      tile.append(bar, name); // the bar sits above the emoji + name
      grid.append(tile);
      return { node: tile, fill, name };
    });
    if (mode === "normie") {
      const ev = makeEvidence();
      ui = { grid, tiles: refs, ev, mode };
      wireEvidence(grid, refs, ev);
      slotEl.replaceChildren(grid, ev.wrap); // evidence sits below the bars
    } else {
      ui = { grid, tiles: refs, ev: null, mode };
      slotEl.replaceChildren(grid); // MEME: bars only, never evidence
    }
    return ui;
  }

  // Freshly built fills start at 0%: give the browser one frame to
  // paint the zeros, then move to the results on the next frame so the
  // width transition animates from zero to the result.
  function fromZero(apply) {
    nextFrame(() => nextFrame(apply));
  }

  function renderResult(answers) {
    const norm = A.normalizeAnswers(answers, Q.questionsFor(mode));
    const tiles = A.tilesFor(mode, norm);
    let points;
    if (mode === "normie") {
      // Independent 0..100 label scores: a null label is displayed as
      // 0, and only a payload where every label is null is empty.
      if (!tiles.some((t) => t.score !== null)) {
        setStatus("No readings for this draft.");
        return;
      }
      points = tiles.map((t) => (t.score === null ? 0 : t.score));
    } else {
      const dist = A.distribution(tiles);
      if (!dist) {
        setStatus("No readings for this draft.");
        return;
      }
      points = dist.points;
    }
    panel.hidden = false; // the first successful result expands the panel
    shownOnce = true;
    if (!slot) return;
    currentNorm = mode === "normie" ? norm : null;
    const animate = modeLoading; // this reply ends a mode-change load
    modeLoading = false;
    const current = ensureGrid(slot, tiles);
    const apply = () => {
      tiles.forEach((_, i) => {
        const p = points[i];
        const ref = current.tiles[i];
        ref.node.setAttribute("aria-valuenow", String(p));
        ref.node.setAttribute("aria-valuetext", p + " of 100 points");
        ref.fill.style.width = p + "%"; // NORMIE: own 0..100; MEME: share of 100
      });
      // a result while evidence is open refreshes the open label's items
      if (current.ev && current.ev.active >= 0) showEvidence(current.ev.active);
    };
    if (animate) fromZero(apply); // bars rise from zero after a mode change
    else apply(); // same mode: widths simply move in place
  }

  async function analyze() {
    timer = null;
    if (sentimentEnabled !== true || !editor || !editor.isConnected) return;
    const text = readDraft(editor);
    if (!text) { // empty draft: hide and invalidate
      resetPending();
      hidePanel();
      return;
    }
    placePanel();
    // Before the first result the panel stays fully collapsed (switch
    // included); the first successful reply expands it. Once expanded,
    // a run without an attached grid (after an error state) shows the
    // reading line again. A mode-change load keeps its spinner.
    if ((!ui || !ui.grid.isConnected) && !modeLoading && shownOnce) {
      setStatus("Reading the draft\u2026");
    }
    const my = gate.take();
    let res;
    try {
      const msg = { type: "composerAnalyze", text, mode };
      if (mode === "normie") msg.questions = Q.normieApi(); // the 50-question NORMIE set
      res = await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (gate.current(my)) setStatus("Extension error. Reload the X tab.", true);
      return;
    }
    if (!gate.current(my)) return; // stale: the text or the mode changed
    if (!res || res.error) {
      const err = res && res.error;
      if (err === "disabled" || err === "sentiment-disabled") {
        hidePanel();
        return;
      }
      if (err === "aborted") return; // a newer request took over
      if (err === "no-key") { setStatus("Add your TypeSafe API key in the extension options.", true); return; }
      setStatus("API error: " + (err || "no answer"), true);
      return;
    }
    renderResult(res.answers || {});
  }

  function schedule() {
    if (sentimentEnabled !== true) return;
    if (timer) clearTimeout(timer);
    // Invalidate an in-flight result immediately, not only when the next
    // request starts. A fast response must not render for text changed during
    // the quiet period. The next analysis runs after the next quiet period.
    gate.bump();
    if (!readDraft(editor)) {
      timer = null;
      hidePanel();
      return;
    }
    timer = setTimeout(analyze, DEBOUNCE_MS);
  }

  // One capture-phase input listener covers every composer instance
  // (main timeline box, modal, inline reply) without bind/unbind churn.
  document.addEventListener("input", (e) => {
    const t = e.target;
    const target = t && t.closest
      ? t.closest(EDITOR_SEL)
      : (t && t.matches && t.matches(EDITOR_SEL) ? t : null);
    if (!target) return;
    editor = target;
    schedule();
  }, true);

  function scan() {
    const cands = editors();
    const currentOk = editor && editor.isConnected && cands.includes(editor);
    const next = currentOk ? editor : pickEditor(cands);
    if (next !== editor) {
      editor = next;
      resetPending();
      if (editor) {
        placePanel();
        // a reopened composer can hold a restored draft: read it once
        if ((editor.innerText || "").trim()) schedule();
        else hidePanel(); // no draft: the panel stays collapsed
      } else {
        if (panel) panel.remove(); // composer closed: X drops the subtree anyway
        panel = null;
        slot = null;
        modeRow = null;
        ui = null; // its grid went down with the panel
      }
    } else if (editor) {
      placePanel(); // re-insert if a rerender dropped the panel
      if (!readDraft(editor)) {
        resetPending();
        hidePanel();
      }
    }
  }

  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 300);
  });

  function applySentimentEnabled(on) {
    sentimentEnabled = on;
    if (!on) {
      resetPending();
      hidePanel();
    } else if (editor && (editor.innerText || "").trim()) {
      schedule();
    }
  }

  async function loadSentimentEnabled() {
    const s = await chrome.storage.local.get(["enabled", "sentimentEnabled"]);
    const legacyEnabled = s.enabled !== false;
    applySentimentEnabled(s.sentimentEnabled === undefined
      ? legacyEnabled : s.sentimentEnabled !== false);
  }

  // The mode is stored as analysisMode. Anything absent or unknown keeps
  // MEME, so existing users (no key stored) default to MEME.
  async function loadMode() {
    try {
      const s = await chrome.storage.local.get(["analysisMode"]);
      mode = s && s.analysisMode === "normie" ? "normie" : "meme";
    } catch (e) {
      mode = "meme"; // storage unavailable: stay on the default
    }
    syncModeUi();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || (!changes.sentimentEnabled && !changes.enabled)) return;
    loadSentimentEnabled();
  });

  scan();
  observer.observe(document.body, { childList: true, subtree: true });
  loadSentimentEnabled();
  loadMode();
})();
