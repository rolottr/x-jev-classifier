// X Jev Classifier — pure analysis for the composer tag panel.
//
// No DOM, no network: the content script and the Node test harness share
// this module. It turns /v1/systemone answers into six tiles and a
// 100-point distribution, for both modes:
//   * MEME — the six classifier tags (SHITPOST, BAIT, CRINGE, SHILLING,
//     PUMP, RAGE) read from the 15-question set;
//   * PRO  — the six structured dimensions (EMOTION, CONVERSATION, SHARE,
//     TIMELY, CRAFT, IDENTITY) read from the merged 50-question set.
//     Every PRO tile value is the mean of its family's answered value
//     questions (noul and score). Choice questions stay in the payload
//     but never feed a tile: their options are nominal, not ordered.
//     FORMAT and ANTI-SIGNAL answers are requested for coverage only
//     and are never displayed.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.XJevComposerAnalysis = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // Quiet period before a draft is analyzed. Exported so composer.js and
  // the test harness agree on it.
  const DEBOUNCE_MS = 800;

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  // Coerce anything into a finite number, or null. Numeric strings like
  // "0.7" are accepted; junk (null, "yes", NaN, Infinity) becomes null.
  function num(v) {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Raw answers ({ id: {noul} | {score} | {choice, probabilities} }) for
  // a question map (MEME or PRO) become:
  //   values:  id -> 0..1  for noul and score questions
  //   choices: id -> { choice: string|null, probabilities: object|null }
  // Score levels divide by (criteria length - 1), mirroring
  // metricsFromAnswers in background.js. Missing or malformed answers are
  // skipped, never thrown.
  function normalizeAnswers(raw, questions) {
    const values = {};
    const choices = {};
    if (!raw || typeof raw !== "object" || !questions) return { values, choices };
    for (const [id, q] of Object.entries(questions)) {
      const ans = raw[id];
      if (!ans || typeof ans !== "object") continue;
      if (q.type === "noul") {
        const v = num(ans.noul);
        if (v !== null) values[id] = clamp01(v);
      } else if (q.type === "score") {
        const v = num(ans.score);
        if (v !== null) {
          const max = Math.max(2, (q.criteria || []).length) - 1;
          values[id] = clamp01(v / max);
        }
      } else if (q.type === "choice") {
        const choice = typeof ans.choice === "string" ? ans.choice : null;
        let probabilities = null;
        if (ans.probabilities && typeof ans.probabilities === "object") {
          probabilities = {};
          for (const [opt, p] of Object.entries(ans.probabilities)) {
            const n = num(p);
            if (n !== null) probabilities[opt] = clamp01(n);
          }
        }
        if (choice !== null || probabilities) choices[id] = { choice, probabilities };
      }
    }
    return { values, choices };
  }

  // P(option) for a choice question, or null when the question is absent.
  // Without a usable probabilities map, a matching pick counts as 1, the
  // rest as 0.
  function prob(norm, id, option) {
    const c = norm.choices && norm.choices[id];
    if (!c) return null;
    if (c.probabilities && c.probabilities[option] !== undefined) {
      return c.probabilities[option];
    }
    return c.choice === option ? 1 : 0;
  }

  // ==== SIX TILES PER MODE ====
  // MEME tiles: the classifier tags, shown as two rows of three:
  //   SHITPOST BAIT    CRINGE
  //   SHILLING PUMP    RAGE
  // NEWS, SCAM and ALPHA are gone. Every tile's `signals` read MEME
  // answers (the classifier's question ids). Rules for every tile and
  // mode:
  //   * value = weighted mean of the answered signals, clamped to 0..1;
  //   * a missing or malformed signal drops out and the remaining weights
  //     renormalize; a tile with no signal at all is null;
  //   * "option" signals read the choice probability, so partial
  //     evidence moves the bar smoothly instead of jumping to 1;
  //   * "inverse" signals flip 0..1 (low question context reads as bait).
  const TAG_TILES = [
    {
      id: "shitpost", emoji: "💩", label: "SHITPOST", color: "#94d82e",
      // type shitpost
      signals: [
        { id: "type", option: "shitpost", weight: 3 },
      ],
    },
    {
      id: "bait", emoji: "🎣", label: "BAIT", color: "#00ba7c",
      // type bait/question + is_bait + reply bait + low question context
      signals: [
        { id: "type", option: "bait", weight: 3 },
        { id: "is_bait", weight: 3 },
        { id: "is_reply_bait_question", weight: 2 },
        { id: "type", option: "question", weight: 1 },
        { id: "question_context", weight: 1, inverse: true },
      ],
    },
    {
      id: "cringe", emoji: "😬", label: "CRINGE", color: "#f91880",
      // type ai_slop + is_slop + slop level
      signals: [
        { id: "type", option: "ai_slop", weight: 3 },
        { id: "is_slop", weight: 3 },
        { id: "slop_level", weight: 3 },
      ],
    },
    {
      id: "shilling", emoji: "🤑", label: "SHILLING", color: "#ffd400",
      // type shill + type money_flex (folded in) + paid-shill + shill level
      signals: [
        { id: "type", option: "shill", weight: 3 },
        { id: "type", option: "money_flex", weight: 3 },
        { id: "is_paid_shill", weight: 2 },
        { id: "shill_level", weight: 2 },
      ],
    },
    {
      id: "pump", emoji: "🚀", label: "PUMP", color: "#00b8d9",
      // type pump + is_pump
      signals: [
        { id: "type", option: "pump", weight: 3 },
        { id: "is_pump", weight: 3 },
      ],
    },
    {
      id: "rage", emoji: "😡", label: "RAGE", color: "#ff7a00",
      // type rage + is_rage
      signals: [
        { id: "type", option: "rage", weight: 3 },
        { id: "is_rage", weight: 3 },
      ],
    },
  ];

  // PRO tiles: the six displayed structured dimensions, in this exact order:
  //   EMOTION CONVERSATION SHARE
  //   TIMELY  CRAFT        IDENTITY
  // Labels never reuse a MEME tag name. Each tile value is the equal-
  // weight mean of its family's answered value questions (noul, score)
  // from the merged 50-question PRO payload. Choice questions inside a
  // family (p_emotion_dominant, p_conv_question_kind, p_conv_reply_
  // forecast, p_time_angle, p_time_position, p_craft_voice, p_identity_
  // role, p_identity_audience, p_identity_sell) stay in the request but
  // never feed the value: their options are nominal, not ordered. FORMAT
  // and ANTI-SIGNAL are requested for coverage only and have no tile.
  const PRO_TILES = [
    {
      id: "emotion", emoji: "🎭", label: "EMOTION", color: "#94d82e",
      family: "EMOTION",
      signals: [
        { id: "p_emotion_milestone" },
        { id: "p_emotion_humour_twist" },
        { id: "p_emotion_self_exposure" },
        { id: "p_emotion_indignation" },
        { id: "p_emotion_relatable" },
        { id: "p_emotion_gushing" },
      ],
    },
    {
      id: "conversation", emoji: "💬", label: "CONVERSATION", color: "#00ba7c",
      family: "CONVERSATION",
      signals: [
        { id: "p_conv_easy_answer" },
        { id: "p_conv_reader_gap" },
        { id: "p_conv_ask_action" },
        { id: "p_conv_contestable" },
        { id: "p_conv_group_challenge" },
      ],
    },
    {
      id: "share", emoji: "📤", label: "SHARE", color: "#f91880",
      family: "SHAREABILITY",
      signals: [
        { id: "p_share_send_on" },
        { id: "p_share_stands_alone" },
        { id: "p_share_reference" },
        { id: "p_share_quotable" },
        { id: "p_share_useful_favour" },
        { id: "p_share_names_accounts" },
      ],
    },
    {
      id: "timely", emoji: "⏰", label: "TIMELY", color: "#ffd400",
      family: "TIMELINESS",
      signals: [
        { id: "p_time_news_anchor" },
        { id: "p_time_meme_format" },
      ],
    },
    {
      id: "craft", emoji: "✍️", label: "CRAFT", color: "#00b8d9",
      family: "CRAFT",
      signals: [
        { id: "p_craft_specific" },
        { id: "p_craft_first_line" },
        { id: "p_craft_payoff_inside" },
        { id: "p_craft_credential" },
        { id: "p_craft_economy" },
        { id: "p_craft_micro_anecdote" },
      ],
    },
    {
      id: "identity", emoji: "🪪", label: "IDENTITY", color: "#ff7a00",
      family: "IDENTITY",
      signals: [
        { id: "p_identity_own_experience" },
        { id: "p_identity_advice" },
        { id: "p_identity_ingroup" },
        { id: "p_identity_outgroup" },
      ],
    },
  ];

  // Weighted mean over one tile's signal set; null when nothing answered.
  // A signal without an explicit weight counts as 1 (the PRO family rule).
  function tileValue(t, norm) {
    let sum = 0;
    let w = 0;
    for (const sig of t.signals) {
      let v = sig.option !== undefined
        ? prob(norm, sig.id, sig.option)
        : (norm.values[sig.id] !== undefined ? norm.values[sig.id] : null);
      if (v === null || v === undefined) continue; // missing or malformed
      if (sig.inverse) v = 1 - clamp01(v);
      const weight = sig.weight === undefined ? 1 : sig.weight;
      sum += weight * v;
      w += weight;
    }
    return w > 0 ? clamp01(sum / w) : null;
  }

  // Fixed order, one entry per tile. value is 0..1, or null when no
  // signal answered at all (the panel shows its empty state then).
  function tilesFromSet(set, norm) {
    return set.map((t) => ({
      id: t.id,
      emoji: t.emoji,
      label: t.label,
      color: t.color,
      value: tileValue(t, norm),
    }));
  }

  function tagTiles(norm) {
    return tilesFromSet(TAG_TILES, norm);
  }

  function tagTilesPro(norm) {
    return tilesFromSet(PRO_TILES, norm);
  }

  function tilesFor(mode, norm) {
    return mode === "pro" ? tagTilesPro(norm) : tagTiles(norm);
  }

  // Tile metadata (no values) for building or relabeling the grid.
  // The two modes carry different ids, emoji and labels.
  function tileMeta(mode) {
    return (mode === "pro" ? PRO_TILES : TAG_TILES).map((t) => ({
      id: t.id,
      emoji: t.emoji,
      label: t.label,
      color: t.color,
    }));
  }

  // ==== 100-POINT DISTRIBUTION ====
  // The six tile values become shares that always sum to exactly 100
  // points. Largest-remainder rounding keeps the sum exact and the result
  // deterministic: floor every share, then hand the leftover points to the
  // biggest fractions, ties going to the earlier tile.
  //   * no tile answered at all -> null (panel keeps its empty state)
  //   * answers exist but every value is 0 -> all points 0 (sum 0)
  function distribution(items) {
    if (!Array.isArray(items) || !items.some((d) => num(d && d.value) !== null)) {
      return null;
    }
    const vals = items.map((d) => {
      const v = num(d && d.value);
      return v === null ? 0 : clamp01(v);
    });
    const total = vals.reduce((a, b) => a + b, 0);
    if (total <= 0) return { points: vals.map(() => 0), total: 0 };
    const raw = vals.map((v) => (100 * v) / total);
    const points = raw.map(Math.floor);
    let rest = 100 - points.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => [i, r - Math.floor(r)])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    for (let k = 0; k < order.length && rest > 0; k++, rest--) {
      points[order[k][0]]++;
    }
    return { points, total: 100 };
  }

  // ==== STALENESS GATE ====
  // Token keeper shared by composer.js and the tests. bump() invalidates
  // every token handed out so far; take() starts a new request token;
  // current(t) tells whether a reply may still render.
  function staleGate() {
    let seq = 0;
    return {
      bump() { seq++; },
      take() { return ++seq; },
      current(t) { return t === seq; },
    };
  }

  // Trailing-edge debounce with cancel(), shared with the test harness.
  function debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(...args); }, ms);
    };
    wrapped.cancel = () => { if (t) clearTimeout(t); t = null; };
    return wrapped;
  }

  return {
    DEBOUNCE_MS, TAG_TILES, PRO_TILES,
    clamp01, num, normalizeAnswers, prob,
    tagTiles, tagTilesPro, tilesFor, tileMeta, distribution,
    staleGate, debounce,
  };
});
