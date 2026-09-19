// X Jev Classifier — pure analysis for the composer tag panel.
//
// No DOM, no network: the content script and the Node test harness share
// this module. It turns /v1/systemone answers into six tiles:
//   * MEME — the six classifier tags (SHITPOST, BAIT, CRINGE, SHILLING,
//     PUMP, RAGE) read from the 15-question set and shown as a
//     largest-remainder 100-point distribution over the six tags.
//   * NORMIE  — the six structured labels (EMOTION, CONVERSATION, SHARE,
//     TIMELY, CRAFT, IDENTITY), each scored 0..100 on its own. Every
//     one of the 50 merged NORMIE questions feeds the scores through the
//     authoritative mapping below (NORMIE_POSITIVES + NORMIE_PENALTIES):
//     the six families' questions contribute positively, FORMAT
//     post_type options route to the label they reward, and the nine
//     ANTI-SIGNAL questions plus the two FORMAT crutches act as
//     penalties on their assigned labels.
//
// NORMIE formula — explicit and deterministic. Each label is independent;
// the six scores share no total and never renormalize against each
// other. With v the normalized 0..1 answer (a choice entry reads
// sum(P(option) * optionWeight), clamped to 0..1):
//   pos   = weighted mean of the label's answered positive entries
//           (entry weight w, default 1); 0 when none answered
//   pen   = plain mean of (strength * v) over the label's answered
//           penalties; 0 when none answered
//   score = round(100 * clamp01(pos * (1 - pen)))
// A label with no positive and no penalty answered at all is null (the
// panel keeps its empty state). A strong label can read 70 or 80 while
// another reads 0; the sum of the six scores is meaningless by design.
//
// Weights below were calibrated against a 1000-probe NORMIE benchmark
// (20 probes per question). Only weak points were lowered, and every
// weight stays in 0.4..1.0; see README for the run's limits.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.XJevComposerAnalysis = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // Quiet period before a draft is analyzed. Exported so composer.js and
  // the test harness agree on it.
  const DEBOUNCE_MS = 800;
  // Evidence needs a clear signal. Weak model confidence is neutral rather
  // than a green or red claim, so the list can show grey points that did not
  // apply to the post.
  const EVIDENCE_CUTOFF = 0.5;

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
  // a question map (MEME or NORMIE) become:
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
  // Every tile's `signals` read MEME answers (the classifier's question
  // ids). Rules for every tile and mode:
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

  // Weighted mean over one tile's signal set; null when nothing answered.
  // A signal without an explicit weight counts as 1.
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

  // ==== NORMIE LABELS ====
  // Tile metadata in display order:
  //   EMOTION CONVERSATION SHARE
  //   TIMELY  CRAFT        IDENTITY
  const NORMIE_TILES = [
    { id: "emotion", emoji: "🎭", label: "EMOTION", color: "#94d82e", family: "EMOTION" },
    { id: "conversation", emoji: "💬", label: "CONVERSATION", color: "#00ba7c", family: "CONVERSATION" },
    { id: "share", emoji: "📤", label: "SHARE", color: "#f91880", family: "SHAREABILITY" },
    { id: "timely", emoji: "⏰", label: "TIMELY", color: "#ffd400", family: "TIMELINESS" },
    { id: "craft", emoji: "✍️", label: "CRAFT", color: "#00b8d9", family: "CRAFT" },
    { id: "identity", emoji: "🪪", label: "IDENTITY", color: "#ff7a00", family: "IDENTITY" },
  ];

  // ==== AUTHORITATIVE NORMIE MAPPING ====
  // Every one of the 50 NORMIE questions must appear here at least once
  // (a question may map to several labels; p_format_post_type maps to
  // five). Positive entries per label:
  //   { id, note }            value question (noul/score), weight 1
  //   { id, note, w }         value question with weight w in (0,1]
  //   { id, note, options }   choice question; each option carries a
  //                           0..1 weight and the entry value is
  //                           clamp01(sum(P(option) * weight))
  // `note` is the evidence line the panel shows (green dot).
  const NORMIE_POSITIVES = {
    emotion: [
      { id: "p_emotion_dominant", options: {
        amusement: 1, warmth: 1, sadness: 0.7, curiosity: 0.4,
        anger: 0.4, embarrassment: 0.2, greed: 0.1,
      }, note: "Moves the reader: laughter, warmth or pity" },
      { id: "p_emotion_milestone", note: "A win told with feeling" },
      { id: "p_emotion_humour_twist", w: 0.7, note: "Funny, with a twist that lands" },
      { id: "p_emotion_self_exposure", note: "Shows the author's soft spots" },
      { id: "p_emotion_indignation", w: 0.7, note: "An indignant, annoyed voice" },
      { id: "p_emotion_relatable", w: 0.5, note: "An experience readers recognize" },
      { id: "p_emotion_gushing", w: 0.5, note: "Warm praise with nothing at stake" },
      { id: "p_format_post_type", options: { joke: 1 }, note: "A joke or bit at its core" },
    ],
    conversation: [
      { id: "p_conv_question_kind", options: {
        genuine: 1, help: 0.6, bare_poll: 0.2,
      }, note: "A real question with context" },
      { id: "p_conv_easy_answer", w: 0.4, note: "Easy and fun to reply to" },
      { id: "p_conv_reader_gap", note: "A gap readers can fill" },
      { id: "p_conv_ask_action", note: "Asks readers to help or connect" },
      { id: "p_conv_contestable", w: 0.6, note: "A claim readers can argue with" },
      { id: "p_conv_group_challenge", note: "Puts a named group on the spot" },
      { id: "p_conv_reply_forecast", options: {
        jokes: 0.8, answers: 1, arguments: 0.8, agreement: 0.6,
      }, note: "Replies will surely come" },
      { id: "p_format_post_type", options: { question: 1 }, note: "Asks the audience something" },
    ],
    share: [
      { id: "p_share_send_on", note: "People would send it on" },
      { id: "p_share_stands_alone", w: 0.5, note: "Stands alone without context" },
      { id: "p_share_reference", note: "Worth saving for later" },
      { id: "p_share_quotable", w: 0.5, note: "One line can be quoted alone" },
      { id: "p_share_useful_favour", note: "Useful to a specific reader" },
      { id: "p_share_names_accounts", note: "Built around naming people" },
    ],
    timely: [
      { id: "p_time_news_anchor", note: "Hangs on fresh outside news" },
      { id: "p_time_angle", options: {
        new_info: 1, take: 0.8, joke: 0.8, report: 0.5,
      }, note: "Adds its own angle to the news" },
      { id: "p_time_position", options: {
        early: 1, ontime: 0.8, timeless: 0.1, late: 0.1,
      }, note: "Sits ahead of the moment" },
      { id: "p_time_meme_format", note: "Built on a live template or meme" },
      { id: "p_format_post_type", options: { news: 1 }, note: "Reports fresh outside news" },
    ],
    craft: [
      { id: "p_craft_specific", w: 0.4, note: "Concrete detail and real numbers" },
      { id: "p_craft_first_line", note: "First line pulls the reader in" },
      { id: "p_craft_payoff_inside", note: "The payoff is inside the post" },
      { id: "p_craft_credential", note: "The author's own result backs it" },
      { id: "p_craft_economy", note: "One clear point, no filler" },
      { id: "p_craft_voice", options: {
        plain: 1, insider: 0.8, formal: 0.5, hype: 0.2,
      }, note: "A plain, direct voice" },
      { id: "p_craft_micro_anecdote", w: 0.5, note: "A short incident that lands" },
      { id: "p_format_post_type", options: { creative: 1 }, note: "Art, video or maker work" },
    ],
    identity: [
      { id: "p_identity_own_experience", note: "The author's own experience is the subject" },
      { id: "p_identity_role", options: {
        peer: 1, expert: 0.8, intro: 0.6, critic: 0.5,
        fan: 0.3, reporter: 0.3, seller: 0.1,
      }, note: "Speaks as a peer, not a brand" },
      { id: "p_identity_advice", note: "Tells the reader what to do" },
      { id: "p_identity_ingroup", note: "Speaks to a group as one of them" },
      { id: "p_identity_outgroup", note: "Names a target or an outgroup" },
      { id: "p_identity_audience", options: {
        niche: 1, community: 0.7, one: 0.5, everyone: 0.2,
      }, note: "A defined audience" },
      { id: "p_identity_sell", options: {
        own_work: 0.8, nothing: 0.5, pitch: 0.2,
      }, note: "Announces the author's own work" },
      { id: "p_format_post_type", options: { story: 1, take: 0.7 }, note: "A personal story or take" },
    ],
  };

  // Penalties: every entry hits only the labels listed in `strengths`,
  // with 0 < s <= 1 capping how hard it can hit that label. All penalty
  // questions are value questions (noul or score): the nine ANTI-SIGNAL
  // questions plus the two FORMAT crutches. `note` is the evidence line
  // the panel shows (red dot).
  const NORMIE_PENALTIES = [
    { id: "p_anti_reply_farm", strengths: { conversation: 1 },
      note: "Farms replies, reposts or follows" },
    { id: "p_anti_ai_slop", strengths: { craft: 0.6 },
      note: "Reads machine-written" },
    { id: "p_anti_empty_words", strengths: { craft: 0.5, emotion: 0.5 },
      note: "Recycled maxim, nothing new" },
    { id: "p_anti_hype_caption", strengths: { emotion: 0.8 },
      note: "Hype words with no substance" },
    { id: "p_anti_incentivised", strengths: { identity: 1 },
      note: "Arranged or paid promotion" },
    { id: "p_anti_bare_announcement", strengths: { identity: 0.7, conversation: 0.5 },
      note: "Newswire tone, nobody speaking" },
    { id: "p_anti_off_platform", strengths: { share: 0.6, conversation: 0.4 },
      note: "Pushes readers off the platform" },
    { id: "p_anti_offensive", strengths: { emotion: 0.5, conversation: 0.5 },
      note: "Abuse or harassment" },
    { id: "p_anti_politics", strengths: { identity: 0.6, conversation: 0.4 },
      note: "Politics or culture war" },
    { id: "p_format_quote_dependence", strengths: { share: 1 },
      note: "Needs the image or quote to make sense" },
    { id: "p_format_reused_template", strengths: { craft: 0.6 },
      note: "A structure seen many times" },
  ];

  // Per-label penalty views, precomputed once so scoring and evidence
  // walk one small list per label.
  const NORMIE_PENALTIES_BY_LABEL = {};
  for (const p of NORMIE_PENALTIES) {
    for (const [labelId, s] of Object.entries(p.strengths)) {
      (NORMIE_PENALTIES_BY_LABEL[labelId] = NORMIE_PENALTIES_BY_LABEL[labelId] || [])
        .push({ id: p.id, s, note: p.note });
    }
  }

  // One mapping entry's 0..1 value from the normalized answers, or null
  // when the question was not answered at all. Choice entries read
  // sum(P(option) * optionWeight), clamped; an answered pick outside the
  // mapped options simply reads 0.
  function normieEntryValue(entry, norm) {
    if (entry.options) {
      if (!norm.choices[entry.id]) return null;
      let v = 0;
      for (const opt of Object.keys(entry.options)) {
        const p = prob(norm, entry.id, opt);
        if (p !== null) v += p * entry.options[opt];
      }
      return clamp01(v);
    }
    const v = norm.values[entry.id];
    return v === undefined ? null : v;
  }

  // One label's independent score (the formula at the top of the file).
  // Returns { pos, pen, score }; score is null only when no positive
  // and no penalty for the label was answered at all.
  function normieLabelScore(labelId, norm) {
    let pSum = 0;
    let pW = 0;
    let xSum = 0;
    let xN = 0;
    for (const e of NORMIE_POSITIVES[labelId] || []) {
      const v = normieEntryValue(e, norm);
      if (v === null) continue;
      const w = e.w === undefined ? 1 : e.w;
      pSum += w * v;
      pW += w;
    }
    for (const e of NORMIE_PENALTIES_BY_LABEL[labelId] || []) {
      const v = norm.values[e.id];
      if (v === undefined) continue;
      xSum += e.s * v;
      xN++;
    }
    if (pW === 0 && xN === 0) return { pos: null, pen: null, score: null };
    const pos = pW > 0 ? pSum / pW : 0;
    const pen = xN > 0 ? xSum / xN : 0;
    // Penalties scale the positive result. This keeps a real positive
    // check visible instead of erasing the bar when several smaller
    // anti-signals are also detected. A full-strength penalty still
    // reduces the label to zero.
    return { pos, pen, score: Math.round(100 * clamp01(pos * (1 - pen))) };
  }

  // NORMIE tiles for the panel. `value` mirrors score/100 so the meter code
  // stays mode-agnostic; `score` is the independent 0..100 label score,
  // null for the empty state.
  function normieTiles(norm) {
    return NORMIE_TILES.map((t) => {
      const r = normieLabelScore(t.id, norm);
      return {
        id: t.id,
        emoji: t.emoji,
        label: t.label,
        color: t.color,
        value: r.score === null ? null : r.score / 100,
        score: r.score,
      };
    });
  }

  // Evidence lines for one label: positives first, then penalties, each in
  // mapping order. A present positive contribution is green; a present
  // penalty is red. A zero or unanswered point is neutral (grey), because
  // the post did not accommodate that good or bad point. Neutral points
  // still list so the user can see that they were not used in the score.
  function normieEvidence(labelId, norm) {
    const out = [];
    for (const e of NORMIE_POSITIVES[labelId] || []) {
      const v = normieEntryValue(e, norm);
      out.push({ plus: v !== null && v >= EVIDENCE_CUTOFF ? true : null, text: e.note });
    }
    for (const e of NORMIE_PENALTIES_BY_LABEL[labelId] || []) {
      const v = norm.values[e.id];
      out.push({ plus: v !== undefined && v >= EVIDENCE_CUTOFF ? false : null, text: e.note });
    }
    return out;
  }

  function tilesFor(mode, norm) {
    return mode === "normie" ? normieTiles(norm) : tagTiles(norm);
  }

  // Tile metadata (no values) for building or relabeling the grid.
  // The two modes carry different ids, emoji and labels.
  function tileMeta(mode) {
    return (mode === "normie" ? NORMIE_TILES : TAG_TILES).map((t) => ({
      id: t.id,
      emoji: t.emoji,
      label: t.label,
      color: t.color,
    }));
  }

  // ==== 100-POINT DISTRIBUTION (MEME ONLY) ====
  // The six MEME tile values become shares that always sum to exactly
  // 100 points. Largest-remainder rounding keeps the sum exact and the
  // result deterministic: floor every share, then hand the leftover
  // points to the biggest fractions, ties going to the earlier tile.
  //   * no tile answered at all -> null (panel keeps its empty state)
  //   * answers exist but every value is 0 -> all points 0 (sum 0)
  // NORMIE never uses this: its six scores are independent 0..100 values.
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
    DEBOUNCE_MS, EVIDENCE_CUTOFF, TAG_TILES, NORMIE_TILES, NORMIE_POSITIVES, NORMIE_PENALTIES,
    clamp01, num, normalizeAnswers, prob,
    tagTiles, normieTiles, normieLabelScore, normieEvidence, tilesFor, tileMeta,
    distribution, staleGate, debounce,
  };
});
