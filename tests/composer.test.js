// Focused harness for the composer tag panel.
// Run: node tests/composer.test.js   (plain Node, no dependencies)
// Covers: classifier question-set parity with background.js, the merged
// 50-question NORMIE set and its source coverage, the authoritative NORMIE
// mapping (every question feeds a label, choice options route, penalties
// hit assigned labels only), independent 0..100 NORMIE label scores that
// share no total, answer normalization, the six MEME tag tiles and the
// six NORMIE label tiles in exact order, the MEME 100-point distribution,
// the NORMIE evidence data (positive/neutral/penalty items), layout classes (no
// card chrome, 7px bar above the label, one semantic mode switch
// top-right, a mode-change spinner, the NORMIE evidence dots), in-place
// grid updates via a DOM harness, the NORMIE evidence hover/focus behavior,
// the empty-draft panel collapse and first-result expansion, the
// zero-to-result bar animation after a mode response, mode switching,
// radar removal, debounce and the stale-result gate.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Q = require("../composer-questions.js");
const A = require("../composer-analysis.js");

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const composerSrc = read("composer.js");
const cssSrc = read("composer.css");
const bgSrc = read("background.js");

// ---- 1. MEME set: the classifier's exact 15 questions ----

// Extract the QUESTIONS object literal from background.js and evaluate it,
// so the test compares against the real feed-classifier payload.
function backgroundQuestions() {
  const start = bgSrc.indexOf("const QUESTIONS = {");
  assert.ok(start >= 0, "background.js defines QUESTIONS");
  const objStart = bgSrc.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = objStart; i < bgSrc.length; i++) {
    const ch = bgSrc[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > 0, "QUESTIONS object closes");
  return new Function(`return (${bgSrc.slice(objStart, end + 1)})`)();
}

const bgQ = backgroundQuestions();

test("classifier set in background.js: 15 questions, 1 choice / 11 noul / 3 score", () => {
  assert.equal(Object.keys(bgQ).length, 15);
  const kinds = {};
  for (const q of Object.values(bgQ)) kinds[q.type] = (kinds[q.type] || 0) + 1;
  assert.deepEqual(kinds, { choice: 1, noul: 11, score: 3 });
});

test("composer module carries exactly the classifier payload for MEME", () => {
  assert.equal(Q.COUNT, 15);
  assert.deepEqual(Q.KINDS, { choice: 1, noul: 11, score: 3 });
  assert.deepEqual(Q.toApi(), bgQ);
  assert.deepEqual(Q.questionsFor("meme"), bgQ);
});

test("meme and normie question ids are unique", () => {
  assert.equal(new Set(Q.IDS).size, Q.IDS.length);
  assert.equal(new Set(Q.NORMIE_IDS).size, Q.NORMIE_IDS.length);
});

test("background composer request picks the question set by mode", () => {
  const block = bgSrc.slice(bgSrc.indexOf("composerAnalyze"));
  assert.ok(block.includes('msg.mode === "normie"'), "NORMIE detected from the message");
  assert.ok(/questions,\s*\n/.test(block), "composer payload uses the chosen set");
  assert.ok(bgSrc.includes("questions: QUESTIONS,"), "feed payload still sends QUESTIONS");
  assert.ok(!bgSrc.includes("XJevComposerQuestions"), "no side module in the worker");
});

// ---- 2. NORMIE set: exactly 50 questions merged from the source set ----

test("NORMIE set: exactly 50 questions, 10 choice / 28 noul / 12 score", () => {
  assert.equal(Q.NORMIE_COUNT, 50);
  assert.deepEqual(Q.NORMIE_KINDS, { choice: 10, noul: 28, score: 12 });
  assert.deepEqual(Q.normieApi(), Q.NORMIE_QUESTIONS);
  assert.deepEqual(Q.questionsFor("normie"), Q.NORMIE_QUESTIONS);
});

test("every NORMIE question is well-formed", () => {
  for (const [id, q] of Object.entries(Q.NORMIE_QUESTIONS)) {
    assert.equal(typeof q.instructions, "string", `${id} has instructions`);
    assert.ok(q.instructions.length > 10, `${id} instructions not empty`);
    if (q.type === "choice") {
      assert.ok(q.criteria && typeof q.criteria === "object", `${id} choice criteria`);
      assert.ok(Object.keys(q.criteria).length >= 2, `${id} has options`);
    } else if (q.type === "score") {
      assert.ok(Array.isArray(q.criteria), `${id} score criteria array`);
      assert.ok(q.criteria.length >= 2, `${id} has rubric levels`);
      for (const c of q.criteria) assert.equal(typeof c, "string", `${id} level text`);
    } else {
      assert.equal(q.type, "noul", `${id} known kind`);
      assert.equal(q.criteria, undefined, `${id} noul has no criteria`);
    }
  }
});

test("source coverage: NORMIE_META matches the NORMIE ids exactly, in order", () => {
  assert.deepEqual(Q.NORMIE_META.map((m) => m.id), Object.keys(Q.NORMIE_QUESTIONS));
  for (const m of Q.NORMIE_META) {
    assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, `${m.id} has sources`);
    assert.equal(typeof m.family, "string", `${m.id} has a family`);
  }
});

test("source coverage: all 61 source ids covered once, 11 merges, 50 questions", () => {
  const flat = Q.NORMIE_META.flatMap((m) => m.sources);
  assert.equal(flat.length, 61, "61 sources total");
  assert.equal(new Set(flat).size, 61, "no source id used twice");
  assert.deepEqual([...new Set(flat)].sort(), [...new Set(Q.NORMIE_SOURCE_IDS)].sort(),
    "sources are exactly the recovered source set");
  assert.equal(new Set(Q.NORMIE_SOURCE_IDS).size, 61, "NORMIE_SOURCE_IDS pins 61 ids");
  assert.equal(Q.NORMIE_META.filter((m) => m.sources.length > 1).length, 11,
    "11 merged questions");
  assert.equal(Q.NORMIE_META.length, 50, "50 NORMIE questions");
});

test("source coverage: every source family stays covered", () => {
  assert.deepEqual(Q.NORMIE_FAMILIES, {
    EMOTION: 7, CONVERSATION: 7, SHAREABILITY: 6, TIMELINESS: 4,
    CRAFT: 7, IDENTITY: 7, FORMAT: 3, "ANTI-SIGNAL": 9,
  });
});

// ---- 2.5 authoritative NORMIE mapping: all 50 questions feed the labels ----

test("NORMIE mapping: every one of the 50 questions feeds at least one label", () => {
  const used = new Set([
    ...Object.values(A.NORMIE_POSITIVES).flatMap((list) => list.map((e) => e.id)),
    ...A.NORMIE_PENALTIES.map((p) => p.id),
  ]);
  for (const id of Q.NORMIE_IDS) {
    assert.ok(used.has(id), `${id} mapped to at least one label`);
  }
  assert.equal(used.size, 50, "the mapping references exactly the 50 NORMIE ids");
});

test("NORMIE mapping: every label has positive entries; all six labels are covered", () => {
  assert.deepEqual(Object.keys(A.NORMIE_POSITIVES).sort(),
    A.NORMIE_TILES.map((t) => t.id).sort(), "one positive list per label");
  for (const t of A.NORMIE_TILES) {
    assert.ok(A.NORMIE_POSITIVES[t.id].length >= 4, `${t.id} carries positives`);
  }
});

test("NORMIE mapping: positive entries reference real questions and valid options", () => {
  for (const [labelId, list] of Object.entries(A.NORMIE_POSITIVES)) {
    for (const e of list) {
      const q = Q.NORMIE_QUESTIONS[e.id];
      assert.ok(q, `${labelId}: ${e.id} exists in the NORMIE set`);
      assert.equal(typeof e.note, "string", `${e.id} has an evidence note`);
      assert.ok(e.note.length > 3 && e.note.length < 60, `${e.id} note is short and readable`);
      if (e.options) {
        assert.equal(q.type, "choice", `${e.id} mapped with options is a choice question`);
        for (const [opt, w] of Object.entries(e.options)) {
          assert.ok(opt in q.criteria, `${e.id}: option ${opt} is listed in the question`);
          assert.ok(w > 0 && w <= 1, `${e.id}.${opt} option weight in (0,1]`);
        }
      } else {
        assert.notEqual(q.type, "choice", `${e.id} without options is a value question`);
        if (e.w !== undefined) assert.ok(e.w > 0 && e.w <= 1, `${e.id} weight in (0,1]`);
      }
    }
  }
});

test("NORMIE mapping: penalties hit only value questions, real labels, strengths in (0,1]", () => {
  assert.ok(A.NORMIE_PENALTIES.length >= 11, "the nine ANTI-SIGNAL plus two FORMAT penalties");
  for (const p of A.NORMIE_PENALTIES) {
    const q = Q.NORMIE_QUESTIONS[p.id];
    assert.ok(q, `${p.id} exists in the NORMIE set`);
    assert.notEqual(q.type, "choice", `${p.id} penalty is a value question`);
    assert.equal(typeof p.note, "string", `${p.id} has an evidence note`);
    const labelIds = Object.keys(p.strengths);
    assert.ok(labelIds.length >= 1, `${p.id} hits at least one label`);
    for (const [labelId, s] of Object.entries(p.strengths)) {
      assert.ok(A.NORMIE_TILES.some((t) => t.id === labelId), `${p.id} hits the real label ${labelId}`);
      assert.ok(s > 0 && s <= 1, `${p.id} -> ${labelId} strength in (0,1]`);
    }
  }
});

test("NORMIE mapping: all nine ANTI-SIGNAL and all three FORMAT questions are used", () => {
  const used = new Set([
    ...Object.values(A.NORMIE_POSITIVES).flatMap((list) => list.map((e) => e.id)),
    ...A.NORMIE_PENALTIES.map((p) => p.id),
  ]);
  const anti = Q.NORMIE_META.filter((m) => m.family === "ANTI-SIGNAL").map((m) => m.id);
  const format = Q.NORMIE_META.filter((m) => m.family === "FORMAT").map((m) => m.id);
  assert.equal(anti.length, 9);
  assert.equal(format.length, 3);
  for (const id of anti.concat(format)) {
    assert.ok(used.has(id), `${id} feeds the NORMIE calculation`);
  }
});

// ---- 3. answer normalization ----

test("noul answers clamp to 0..1 and coerce numeric strings", () => {
  const n = A.normalizeAnswers({
    is_scam: { noul: 0.7 },
    is_bait: { noul: -1 },
    is_pump: { noul: 2 },
    is_rage: { noul: "0.5" },
    is_slop: { noul: "junk" },
    is_alpha: { score: 3 }, // score shape on a noul question: ignored
  }, Q.toApi());
  assert.equal(n.values.is_scam, 0.7);
  assert.equal(n.values.is_bait, 0);
  assert.equal(n.values.is_pump, 1);
  assert.equal(n.values.is_rage, 0.5);
  assert.equal(n.values.is_slop, undefined);
  assert.equal(n.values.is_alpha, undefined);
});

test("score answers map the four levels 0..3 onto 0..1", () => {
  const n = A.normalizeAnswers({
    shill_level: { score: 0 },
    slop_level: { score: 2 },
    question_effort: { score: 3 },
    is_paid_shill: { score: 9 }, // wrong kind for a noul id: ignored
  }, Q.toApi());
  assert.equal(n.values.shill_level, 0);
  assert.equal(n.values.slop_level, 2 / 3);
  assert.equal(n.values.question_effort, 1);
  assert.equal(n.values.is_paid_shill, undefined);
});

test("NORMIE score answers use the NORMIE rubric length", () => {
  const n = A.normalizeAnswers({
    p_anti_ai_slop: { score: 3 },
    p_emotion_indignation: { score: 1 },
    p_share_reference: { score: "2" },
  }, Q.normieApi());
  assert.equal(n.values.p_anti_ai_slop, 1);
  assert.equal(n.values.p_emotion_indignation, 1 / 3);
  assert.equal(n.values.p_share_reference, 2 / 3);
});

test("choice answers keep pick and clamped probabilities", () => {
  const n = A.normalizeAnswers({
    type: { choice: "bait", probabilities: { bait: 0.62, question: -0.2, news: 2 } },
  }, Q.toApi());
  const t = n.choices.type;
  assert.equal(t.choice, "bait");
  assert.equal(t.probabilities.bait, 0.62);
  assert.equal(t.probabilities.question, 0);
  assert.equal(t.probabilities.news, 1);
  assert.equal(n.values.type, undefined); // choice never becomes a value
});

test("NORMIE choice answers parse like MEME ones", () => {
  const n = A.normalizeAnswers({
    p_emotion_dominant: { choice: "amusement", probabilities: { amusement: 0.8, greed: 0.1 } },
  }, Q.normieApi());
  const t = n.choices.p_emotion_dominant;
  assert.equal(t.choice, "amusement");
  assert.equal(t.probabilities.amusement, 0.8);
  assert.equal(t.probabilities.greed, 0.1);
});

test("missing or malformed bulk answers never throw", () => {
  for (const bad of [null, undefined, "x", 42, [], {}]) {
    for (const set of [Q.toApi(), Q.normieApi()]) {
      const n = A.normalizeAnswers(bad, set);
      assert.deepEqual(n.values, {});
      assert.deepEqual(n.choices, {});
    }
  }
});

test("prob uses probabilities, then pick fallback, else null", () => {
  const withProbs = A.normalizeAnswers({
    type: { choice: "bait", probabilities: { bait: 0.4 } },
  }, Q.toApi());
  assert.equal(A.prob(withProbs, "type", "bait"), 0.4);
  assert.equal(A.prob(withProbs, "type", "news"), 0);
  assert.equal(A.prob(withProbs, "is_scam", "bait"), null);

  const pickOnly = A.normalizeAnswers({ type: { choice: "shill" } }, Q.toApi());
  assert.equal(A.prob(pickOnly, "type", "shill"), 1);
  assert.equal(A.prob(pickOnly, "type", "bait"), 0);
});

// ---- 4. the six tiles per mode ----

const tileIdx = (id) => A.TAG_TILES.findIndex((t) => t.id === id);
const normieIdx = (id) => A.NORMIE_TILES.findIndex((t) => t.id === id);

test("six MEME tag tiles in exact row-by-row order, uppercase labels", () => {
  assert.deepEqual(A.TAG_TILES.map((t) => t.id),
    ["shitpost", "bait", "cringe", "shilling", "pump", "rage"]);
  for (const gone of ["news", "scam", "alpha"]) {
    assert.ok(!A.TAG_TILES.some((t) => t.id === gone), `${gone} tile removed`);
  }
  const meme = A.tileMeta("meme");
  assert.deepEqual(meme.map((t) => t.emoji + " " + t.label), [
    "💩 SHITPOST", "🎣 BAIT", "😬 CRINGE",
    "🤑 SHILLING", "🚀 PUMP", "😡 RAGE",
  ]);
  const rows = [
    meme.slice(0, 3).map((t) => t.label),
    meme.slice(3, 6).map((t) => t.label),
  ];
  assert.deepEqual(rows, [
    ["SHITPOST", "BAIT", "CRINGE"],
    ["SHILLING", "PUMP", "RAGE"],
  ]);
  for (const t of meme) {
    assert.equal(t.label, t.label.toUpperCase(), `${t.id} uppercase`);
    assert.ok(/[^\x00-\x7f]/.test(t.emoji), `${t.id} has an emoji`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(t.color), `${t.id} color`);
  }
});

test("six NORMIE label tiles: exact order, families and metadata kept", () => {
  assert.deepEqual(A.NORMIE_TILES.map((t) => t.id),
    ["emotion", "conversation", "share", "timely", "craft", "identity"]);
  assert.deepEqual(A.NORMIE_TILES.map((t) => t.family), [
    "EMOTION", "CONVERSATION", "SHAREABILITY", "TIMELINESS", "CRAFT", "IDENTITY",
  ]);
  const meme = A.tileMeta("meme");
  const normie = A.tileMeta("normie");
  assert.deepEqual(normie.map((t) => t.label), [
    "EMOTION", "CONVERSATION", "SHARE",
    "TIMELY", "CRAFT", "IDENTITY",
  ]);
  const memeLabels = new Set(meme.map((t) => t.label));
  for (const t of normie) {
    assert.ok(!memeLabels.has(t.label), `NORMIE label ${t.label} reuses a MEME tag name`);
    assert.equal(t.label, t.label.toUpperCase(), `${t.id} uppercase`);
    assert.ok(/[^\x00-\x7f]/.test(t.emoji), `${t.id} has an emoji`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(t.color), `${t.id} color`);
  }
  assert.equal(normie.length, 6, "NORMIE keeps exactly six tiles");
  // every NORMIE emoji differs from every MEME emoji on the same tile set
  const memeEmoji = new Set(meme.map((t) => t.emoji));
  for (const t of normie) {
    assert.ok(!memeEmoji.has(t.emoji), `${t.emoji} is not a MEME emoji`);
  }
});

test("NORMIE tiles no longer carry family signal lists: the mapping drives them", () => {
  for (const t of A.NORMIE_TILES) {
    assert.equal(t.signals, undefined, `${t.id} has no legacy signals field`);
  }
});

test("empty answers give all-null tiles in both modes", () => {
  for (const [set, fn] of [
    [Q.toApi(), A.tagTiles],
    [Q.normieApi(), A.normieTiles],
  ]) {
    const tiles = fn(A.normalizeAnswers({}, set));
    assert.equal(tiles.length, 6);
    for (const t of tiles) assert.equal(t.value, null, `${t.id}`);
  }
  for (const t of A.normieTiles(A.normalizeAnswers({}, Q.normieApi()))) {
    assert.equal(t.score, null, `${t.id} score null`);
  }
});

test("every MEME tile signal references a real classifier question", () => {
  for (const t of A.TAG_TILES) {
    assert.ok(t.signals.length > 0, `${t.id} has MEME signals`);
    for (const sig of t.signals) {
      const q = Q.QUESTIONS[sig.id];
      assert.ok(q, `${t.id}.${sig.id} exists in the classifier set`);
      if (sig.option !== undefined) {
        assert.equal(q.type, "choice", `${t.id}.${sig.id} must be the choice question`);
        assert.ok(Object.keys(q.criteria).includes(sig.option), `${t.id}.${sig.option} is a listed archetype`);
      } else {
        assert.notEqual(q.type, "choice", `${t.id}.${sig.id} used as a value must be noul or score`);
      }
    }
  }
});

test("money_flex folds into SHILLING", () => {
  const i = tileIdx("shilling");
  const tiles = A.tagTiles(A.normalizeAnswers({
    type: { choice: "money_flex", probabilities: { money_flex: 1 } },
  }, Q.toApi()));
  // P(shill)=0 and P(money_flex)=1 are both answered: (3*0 + 3*1) / 6 = 0.5,
  // and every other tile reads 0, so SHILLING takes all 100 points.
  assert.ok(Math.abs(tiles[i].value - 0.5) < 1e-9, `shilling ${tiles[i].value}`);
  assert.equal(A.distribution(tiles).points[i], 100, "fold takes the full share");
});

test("SHILLING hand-computed weighted mean (MEME)", () => {
  // (3*0.8 + 3*0.2 + 2*1 + 2*1) / (3+3+2+2) = 0.7
  const i = tileIdx("shilling");
  const tiles = A.tagTiles(A.normalizeAnswers({
    type: { choice: "shill", probabilities: { shill: 0.8, money_flex: 0.2 } },
    is_paid_shill: { noul: 1 },
    shill_level: { score: 3 },
  }, Q.toApi()));
  assert.ok(Math.abs(tiles[i].value - 0.7) < 1e-9, `shilling ${tiles[i].value}`);
});

test("BAIT uses reply bait and inverse question context (MEME)", () => {
  // (2*1 + 1*(1-0)) / 3 = 1 with no context; (2*1 + 1*(1-1)) / 3 = 2/3 with full context
  const i = tileIdx("bait");
  const low = A.tagTiles(A.normalizeAnswers({
    is_reply_bait_question: { noul: 1 }, question_context: { noul: 0 },
  }, Q.toApi()))[i].value;
  const high = A.tagTiles(A.normalizeAnswers({
    is_reply_bait_question: { noul: 1 }, question_context: { noul: 1 },
  }, Q.toApi()))[i].value;
  assert.ok(Math.abs(low - 1) < 1e-9, `low context ${low}`);
  assert.ok(Math.abs(high - 2 / 3) < 1e-9, `full context ${high}`);
});

// ---- 4.5 NORMIE label scores: independent, deterministic, penalized ----

test("NORMIE formula: weighted mean of positives, rounded to 0..100", () => {
  // craft positives: p_craft_specific 1 (w 0.4) and p_craft_first_line 2/3
  // (w 1) -> pos = (0.4 + 2/3) / 1.4 = 16/21 -> round(76.19) = 76
  const norm = A.normalizeAnswers({
    p_craft_specific: { score: 3 },
    p_craft_first_line: { score: 2 },
  }, Q.normieApi());
  const r = A.normieLabelScore("craft", norm);
  assert.ok(Math.abs(r.pos - 16 / 21) < 1e-9, `pos ${r.pos}`);
  assert.equal(r.pen, 0);
  assert.equal(r.score, 76);
});

test("NORMIE formula: entry weights shape the mean; a strong label reads 80", () => {
  // emotion: relatable 1 (w 0.5) + indignation 2/3 (w 0.7) + gushing 0 (w 0.5)
  // pos = (0.5 + 0.7*2/3 + 0) / 1.7 = 0.96667 / 1.7 = 0.5686 -> 57
  const norm = A.normalizeAnswers({
    p_emotion_relatable: { score: 3 },
    p_emotion_indignation: { score: 2 },
    p_emotion_gushing: { noul: 0 },
  }, Q.normieApi());
  const r = A.normieLabelScore("emotion", norm);
  assert.equal(r.score, 57);
  // and a plain 0.8 mean with no penalties reads exactly 80
  const strong = A.normalizeAnswers({
    p_share_send_on: { score: 3 },
    p_share_quotable: { noul: 0.4 },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("share", strong).score, 80);
});

test("NORMIE formula: penalties scale the positive result; floor at 0", () => {
  // craft pos = 1 (single entry, its w cancels); ai_slop score 2 ->
  // v = 2/3, strength 0.6 -> pen = 0.4; score = round(100 * 0.6) = 60
  const mid = A.normalizeAnswers({
    p_craft_specific: { score: 3 },
    p_anti_ai_slop: { score: 2 },
  }, Q.normieApi());
  const r = A.normieLabelScore("craft", mid);
  assert.ok(Math.abs(r.pen - 0.4) < 1e-9, `pen ${r.pen}`);
  assert.equal(r.score, 60);
  // full slop plus a reused template: pen = mean(0.6, 0.6) = 0.6 -> 40
  const hard = A.normalizeAnswers({
    p_craft_specific: { score: 3 },
    p_anti_ai_slop: { score: 3 },
    p_format_reused_template: { noul: 1 },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("craft", hard).score, 40);
  // penalties alone can never go below 0
  const only = A.normalizeAnswers({ p_anti_ai_slop: { score: 3 } }, Q.normieApi());
  assert.equal(A.normieLabelScore("craft", only).score, 0);
  assert.equal(A.normieLabelScore("craft", only).pos, 0, "no positives -> pos 0");
});

test("NORMIE formula: a green check stays visible when smaller penalties exist", () => {
  // A positive 1/3 with a 0.4 penalty used to clamp to zero under
  // subtraction. Scaling keeps the positive signal visible at 20.
  const norm = A.normalizeAnswers({
    p_craft_specific: { score: 1 },
    p_anti_ai_slop: { score: 2 },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("craft", norm).score, 20);
});

test("NORMIE choice options feed labels through their probabilities", () => {
  // p_emotion_dominant: P(amusement)=0.8 (weight 1) + P(curiosity)=0.2 (weight 0.4)
  // entry value = 0.8 + 0.08 = 0.88; the only answered emotion entry -> 88
  const norm = A.normalizeAnswers({
    p_emotion_dominant: {
      choice: "amusement",
      probabilities: { amusement: 0.8, curiosity: 0.2 },
    },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("emotion", norm).score, 88);
  // a pick without probabilities counts fully
  const pick = A.normalizeAnswers({
    p_emotion_dominant: { choice: "amusement" },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("emotion", pick).score, 100);
  // an answered pick outside the mapped options reads 0, not null
  const none = A.normalizeAnswers({
    p_emotion_dominant: { choice: "nothing" },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("emotion", none).score, 0);
});

test("NORMIE choice mapping: p_format_post_type options route to the right labels", () => {
  const pick = (opt) => A.normalizeAnswers({
    p_format_post_type: { choice: opt, probabilities: { [opt]: 1 } },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("emotion", pick("joke")).score, 100, "joke -> EMOTION");
  assert.equal(A.normieLabelScore("conversation", pick("question")).score, 100, "question -> CONVERSATION");
  assert.equal(A.normieLabelScore("timely", pick("news")).score, 100, "news -> TIMELY");
  assert.equal(A.normieLabelScore("craft", pick("creative")).score, 100, "creative -> CRAFT");
  assert.equal(A.normieLabelScore("identity", pick("story")).score, 100, "story -> IDENTITY");
  // unmapped combos read 0 for the label, and SHARE never maps post_type
  assert.equal(A.normieLabelScore("share", pick("joke")).score, null, "SHARE has no post_type entry");
  assert.equal(A.normieLabelScore("craft", pick("joke")).score, 0, "joke gives CRAFT nothing");
});

test("NORMIE choice mapping: option weights grade the contribution", () => {
  // p_time_position: early 1, ontime 0.8, late 0.1, timeless 0.1
  const late = A.normalizeAnswers({
    p_time_position: { choice: "late", probabilities: { late: 1 } },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("timely", late).score, 10, "a late post is barely timely");
  const early = A.normalizeAnswers({
    p_time_position: { choice: "early", probabilities: { early: 1 } },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("timely", early).score, 100, "an early post is fully timely");
});

// ---- 2.6 benchmark tuning (100 historical posts, /tmp NORMIE replay) ----
// The 100-sample benchmark showed five questions firing almost everywhere
// (quotable 100/100, reused_template 99/99, meme_format 38/100 incl. plain
// news and questions) and politics misfiring on a song joke and TV gossip.
// The wordings were tightened; these tests pin the tightening markers so a
// refactor cannot silently restore the loose text.

test("benchmark tuning: tightened NORMIE wordings carry their guards", () => {
  const pins = {
    p_share_quotable: "never quotable",
    p_format_reused_template: "is not a recycled template",
    p_time_meme_format: "is not a meme format",
    p_anti_politics: "the post must take a side",
    p_conv_easy_answer: "nothing to say, score low",
    p_emotion_humour_twist: "A twist or punchline adds, it is not required",
  };
  for (const [id, marker] of Object.entries(pins)) {
    const q = Q.NORMIE_QUESTIONS[id];
    assert.ok(q, `${id} stays in the NORMIE set`);
    assert.ok(q.instructions.includes(marker),
      `${id} keeps its tightened wording (${marker})`);
  }
});

test("benchmark tuning: tightened questions keep their id, type and choices", () => {
  for (const id of ["p_share_quotable", "p_format_reused_template", "p_time_meme_format",
    "p_anti_politics", "p_conv_easy_answer", "p_emotion_humour_twist"]) {
    const q = Q.NORMIE_QUESTIONS[id];
    assert.ok(typeof q.instructions === "string" && q.instructions.length > 0, `${id} instructed`);
  }
  // score questions keep their 4-level rubric; the noul ones stay noul
  assert.equal(Q.NORMIE_QUESTIONS.p_conv_easy_answer.criteria.length, 4);
  assert.equal(Q.NORMIE_QUESTIONS.p_emotion_humour_twist.criteria.length, 4);
  for (const id of ["p_share_quotable", "p_format_reused_template",
    "p_time_meme_format", "p_anti_politics"]) {
    assert.equal(Q.NORMIE_QUESTIONS[id].type, "noul", `${id} stays noul`);
  }
});

test("benchmark tuning: p_anti_offensive stays as calibrated (all 10 firings justified)", () => {
  assert.equal(Q.NORMIE_QUESTIONS.p_anti_offensive.instructions, "Abuse or harassment",
    "the benchmark showed no offensive false positives: wording untouched");
});

test("benchmark tuning: a timeless-only answer barely feeds TIMELY", () => {
  // 39/100 benchmark posts read "timeless"; 0.4 credit left TIMELY without a
  // low end. timeless now pays the same floor as late: 10 of 100.
  const norm = A.normalizeAnswers({
    p_time_position: { choice: "timeless", probabilities: { timeless: 1 } },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("timely", norm).score, 10, "timeless pays 0.1, not 0.4");
});

test("anti-signal penalties lower only their assigned labels", () => {
  const base = A.normalizeAnswers({
    p_craft_specific: { score: 3 },
    p_emotion_milestone: { noul: 1 },
    p_identity_own_experience: { noul: 1 },
  }, Q.normieApi());
  const hit = A.normalizeAnswers({
    p_craft_specific: { score: 3 },
    p_emotion_milestone: { noul: 1 },
    p_identity_own_experience: { noul: 1 },
    p_anti_ai_slop: { score: 3 }, // strength: craft 0.6 only
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("craft", base).score, 100);
  assert.equal(A.normieLabelScore("craft", hit).score, 40, "CRAFT punished");
  assert.equal(A.normieLabelScore("emotion", hit).score, 100, "EMOTION untouched");
  assert.equal(A.normieLabelScore("identity", hit).score, 100, "IDENTITY untouched");
  assert.equal(A.normieLabelScore("share", hit).score, null, "SHARE still has no answers");
});

test("a penalty with several assigned labels hits each at its own strength", () => {
  // p_anti_politics: identity 0.6, conversation 0.4
  const norm = A.normalizeAnswers({
    p_identity_own_experience: { noul: 1 },
    p_conv_easy_answer: { score: 3 },
    p_anti_politics: { noul: 1 },
  }, Q.normieApi());
  assert.equal(A.normieLabelScore("identity", norm).score, 40, "1 - 0.6");
  assert.equal(A.normieLabelScore("conversation", norm).score, 60, "1 - 0.4");
  assert.equal(A.normieLabelScore("emotion", norm).score, null, "EMOTION never assigned");
});

test("NORMIE labels are independent: two labels can both read 100, no shared total", () => {
  const norm = A.normalizeAnswers({
    p_share_send_on: { score: 3 },
    p_craft_first_line: { score: 3 },
  }, Q.normieApi());
  const tiles = A.normieTiles(norm);
  assert.equal(tiles[normieIdx("share")].score, 100);
  assert.equal(tiles[normieIdx("craft")].score, 100);
  const sum = tiles.map((t) => t.score || 0).reduce((a, b) => a + b, 0);
  assert.equal(sum, 200, "the six scores do not share a 100-point total");
  assert.equal(tiles[normieIdx("emotion")].score, null, "unanswered labels stay null");
  assert.equal(tiles[normieIdx("share")].value, 1, "value mirrors score/100");
});

test("NORMIE labels are independent: every label can read 100 at once", () => {
  const answers = {};
  const high = [
    "p_emotion_relatable", "p_conv_easy_answer", "p_share_quotable",
    "p_time_news_anchor", "p_craft_economy", "p_identity_advice",
  ];
  for (const id of high) {
    answers[id] = Q.NORMIE_QUESTIONS[id].type === "score" ? { score: 3 } : { noul: 1 };
  }
  const tiles = A.normieTiles(A.normalizeAnswers(answers, Q.normieApi()));
  for (const t of tiles) assert.equal(t.score, 100, `${t.id} full`);
  assert.equal(tiles.map((t) => t.score).reduce((a, b) => a + b, 0), 600,
    "sums far past 100 by design");
});

test("normieTiles carries tile metadata plus the independent score", () => {
  const tiles = A.normieTiles(A.normalizeAnswers({ p_share_send_on: { score: 3 } }, Q.normieApi()));
  assert.equal(tiles.length, 6);
  assert.equal(tiles[normieIdx("share")].emoji, "📤");
  assert.equal(tiles[normieIdx("share")].label, "SHARE");
  for (const t of tiles) {
    assert.ok(t.score === null || (Number.isInteger(t.score) && t.score >= 0 && t.score <= 100),
      `${t.id} score integer 0..100 or null`);
  }
});

test("tilesFor dispatches by mode", () => {
  const meme = A.tilesFor("meme", A.normalizeAnswers({ is_pump: { noul: 1 } }, Q.toApi()));
  assert.equal(meme[tileIdx("pump")].value, 1);
  assert.equal(meme[tileIdx("pump")].emoji, "🚀");
  const normie = A.tilesFor("normie", A.normalizeAnswers({ p_craft_first_line: { score: 2 } }, Q.normieApi()));
  assert.equal(normie[normieIdx("craft")].score, 67, "first-line rubric reads as CRAFT in NORMIE");
  assert.equal(normie[normieIdx("craft")].emoji, "✍️");
});

test("partial answers never produce NaN", () => {
  for (const [set, fn] of [
    [Q.toApi(), A.tagTiles],
    [Q.normieApi(), A.normieTiles],
  ]) {
    const tiles = fn(A.normalizeAnswers({
      type: { choice: "bait", probabilities: { bait: "junk" } },
      is_scam: { noul: 1 },
      slop_level: { score: "x" },
      p_anti_ai_slop: { score: "x" },
    }, set));
    for (const t of tiles) {
      assert.ok(t.value === null || Number.isFinite(t.value), `${t.id} finite`);
    }
  }
});

// ---- 4.6 NORMIE evidence data ----

test("normieEvidence lists positive, neutral and penalty points in mapping order", () => {
  const norm = A.normalizeAnswers({
    p_share_send_on: { score: 3 },
    p_share_quotable: { noul: 0 }, // answered zero: failed positive check
    p_share_reference: { score: 2 }, // listed after send_on
    p_format_quote_dependence: { noul: 1 }, // penalty listed
  }, Q.normieApi());
  assert.deepEqual(A.normieEvidence("share", norm), [
    { plus: true, text: "People would send it on" },
    { plus: null, text: "Stands alone without context" },
    { plus: true, text: "Worth saving for later" },
    { plus: null, text: "One line can be quoted alone" },
    { plus: null, text: "Useful to a specific reader" },
    { plus: null, text: "Built around naming people" },
    { plus: null, text: "Pushes readers off the platform" },
    { plus: false, text: "Needs the image or quote to make sense" },
  ]);
});

test("normieEvidence marks unanswered questions as neutral", () => {
  const norm = A.normalizeAnswers({
    p_share_send_on: { score: 3 },
    p_anti_reply_farm: { score: 3 }, // conversation penalty, not share's
  }, Q.normieApi());
  const share = A.normieEvidence("share", norm);
  assert.equal(share.length, 8, "all share points stay visible");
  assert.deepEqual(share.find((x) => x.text === "People would send it on"),
    { plus: true, text: "People would send it on" });
  assert.deepEqual(share.find((x) => x.text === "Stands alone without context"),
    { plus: null, text: "Stands alone without context" });
  const conversation = A.normieEvidence("conversation", norm);
  assert.deepEqual(conversation.find((x) => x.text === "Farms replies, reposts or follows"),
    { plus: false, text: "Farms replies, reposts or follows" });
  assert.ok(conversation.some((x) => x.plus === null), "unanswered conversation points are grey");
});

test("normieEvidence marks an answered zero penalty as neutral", () => {
  const norm = A.normalizeAnswers({ p_anti_offensive: { noul: 0 } }, Q.normieApi());
  const emotion = A.normieEvidence("emotion", norm);
  assert.equal(emotion.length, 11, "all emotion points stay visible");
  assert.deepEqual(emotion.find((x) => x.text === "Abuse or harassment"),
    { plus: null, text: "Abuse or harassment" });
});

test("normieEvidence greys weak signals below the confidence cutoff", () => {
  assert.equal(A.EVIDENCE_CUTOFF, 0.5);
  const norm = A.normalizeAnswers({
    p_emotion_milestone: { noul: 0.49 },
    p_anti_politics: { noul: 0.49 },
  }, Q.normieApi());
  assert.deepEqual(A.normieEvidence("emotion", norm).find((x) => x.text === "A win told with feeling"), {
    plus: null, text: "A win told with feeling",
  });
  assert.deepEqual(A.normieEvidence("conversation", norm).find((x) => x.text === "Politics or culture war"), {
    plus: null, text: "Politics or culture war",
  });
});

// ---- 5. the 100-point distribution over six tiles ----

const T = (v) => ({ value: v });

test("distribution: null unless some tile answered (empty state)", () => {
  assert.equal(A.distribution(A.tagTiles(A.normalizeAnswers({}, Q.toApi()))), null);
  assert.equal(A.distribution([]), null);
});

test("distribution: shares sum to exactly 100 for six-tile samples", () => {
  const samples = [
    [1, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1],
    [0.3, 0.3, 0.3, 0, 0, 0.1],
    [0.99, 0.01, 0.5, 0.25, 0.75, 0.1],
    [0.62, 0.21, 0, 0.02, 0.05, 0.03],
  ];
  for (const vals of samples) {
    const dist = A.distribution(vals.map(T));
    assert.ok(dist, "distribution exists");
    assert.equal(dist.total, 100);
    assert.equal(dist.points.reduce((a, b) => a + b, 0), 100, `${vals} sums to 100`);
    for (const p of dist.points) assert.ok(Number.isInteger(p) && p >= 0 && p <= 100);
  }
});

test("distribution: six equal shares split deterministically (100/6)", () => {
  const dist = A.distribution(Array.from({ length: 6 }, () => T(1)));
  assert.deepEqual(dist.points, [17, 17, 17, 17, 16, 16]);
  assert.deepEqual(A.distribution(Array.from({ length: 6 }, () => T(1))).points, dist.points, "stable");
});

test("distribution: missing answers count as zero; one signal takes all 100", () => {
  const items = [T(0.4)].concat(Array.from({ length: 5 }, () => T(null)));
  assert.deepEqual(A.distribution(items).points, [100, 0, 0, 0, 0, 0]);
});

test("distribution: all-zero answers give all-zero points", () => {
  const tiles = A.tagTiles(A.normalizeAnswers({
    is_scam: { noul: 0 },
    is_bait: { noul: 0 },
  }, Q.toApi()));
  const dist = A.distribution(tiles);
  assert.equal(dist.total, 0);
  assert.deepEqual(dist.points, [0, 0, 0, 0, 0, 0]);
});

test("distribution stays a MEME-only concept: NORMIE scores are never fed through it", () => {
  // MEME keeps the shared 100-point split...
  const memeTiles = A.tagTiles(A.normalizeAnswers({ is_bait: { noul: 1 } }, Q.toApi()));
  const dist = A.distribution(memeTiles);
  assert.equal(dist.total, 100);
  assert.equal(dist.points.reduce((a, b) => a + b, 0), 100);
  // ...while NORMIE keeps its independent scores that need no distribution
  const normieTiles = A.normieTiles(A.normalizeAnswers({
    p_emotion_gushing: { noul: 0.5 },
    p_share_quotable: { noul: 0.5 },
    p_craft_economy: { noul: 0.25 },
  }, Q.normieApi()));
  assert.equal(normieTiles[normieIdx("emotion")].score, 50);
  assert.equal(normieTiles[normieIdx("share")].score, 50);
  assert.equal(normieTiles[normieIdx("craft")].score, 25);
});

// ---- 6. rendering contract: 3x2 tiles, mode toggle, no radar ----

test("analysis module no longer exposes radar or dimension helpers", () => {
  for (const gone of ["radarSvg", "radarPoints", "sentimentDimensions", "distributionDims", "DIMENSIONS"]) {
    assert.equal(A[gone], undefined, `${gone} removed`);
  }
});

test("composer.js builds tiles with DOM APIs only; no innerHTML, no svg, no form selector", () => {
  assert.ok(!composerSrc.includes("innerHTML"), "no innerHTML anywhere");
  assert.ok(!/svg|radar/i.test(composerSrc), "no svg or radar references");
  assert.ok(!composerSrc.includes('closest("form")'), "no form selector");
  assert.ok(composerSrc.includes('"xjc-grid"'), "grid class");
  assert.ok(composerSrc.includes('"xjc-tile"'), "tile class");
  assert.ok(composerSrc.includes("xjc-tile-bar"), "tile bar present");
});

test("composer.js appends the bar before the name in every tile", () => {
  assert.ok(composerSrc.includes("tile.append(bar, name)"), "bar first, name second");
});

test("composer.js builds ONE semantic switch, not two standalone buttons", () => {
  assert.ok(composerSrc.includes('"xjc-mode"'), "mode row class");
  assert.ok(composerSrc.includes('"xjc-switch"'), "switch class");
  assert.ok(composerSrc.includes('setAttribute("role", "switch")'), "one semantic switch role");
  assert.ok(composerSrc.includes('"xjc-opt xjc-opt-"') && composerSrc.includes('opt("normie", "🚀 NORMIE")')
    && composerSrc.includes('opt("meme", "🤮 MEME"'),
    "internal rocket-NORMIE / puking-face-MEME labels");
  assert.ok(composerSrc.indexOf('opt("normie"') < composerSrc.indexOf('opt("meme"'),
    "NORMIE label built before MEME (left side)");
  assert.ok(!composerSrc.includes('"xjc-mode-btn"'), "no standalone mode buttons");
  assert.ok(!composerSrc.includes("aria-pressed"), "no two-button pressed states");
  assert.ok(composerSrc.includes('setAttribute("aria-checked"'),
    "switch state rides one aria-checked value");
});

test("composer.js parks the switch row first, above the bars", () => {
  assert.ok(composerSrc.includes("body.append(makeModeRow(), slot)"),
    "mode row appended before the slot: top-right, above the six bars");
  assert.ok(!composerSrc.includes("body.append(slot, makeModeRow())"),
    "old below-the-bars order gone");
});

test("composer.js swaps the bars for a spinner on a mode change, then rebuilds from zero", () => {
  assert.ok(composerSrc.includes('"xjc-load"'), "loading wrap class");
  assert.ok(composerSrc.includes('"xjc-spinner"'), "spinner class");
  assert.ok(composerSrc.includes("beginModeLoad"), "a mode change starts the spinner");
  assert.ok(composerSrc.includes("replaceChildren(spinnerNode())"),
    "the spinner replaces the bars in the slot");
  assert.ok(composerSrc.includes("function fromZero"), "zero-start animation helper");
  assert.ok(composerSrc.includes("nextFrame(() => nextFrame(apply))"),
    "zero state painted for one frame before the bars move");
  assert.ok(composerSrc.includes("modeLoading"), "mode-load state tracked");
});

test("composer.js persists analysisMode and keeps MEME the default", () => {
  assert.ok(composerSrc.includes("analysisMode"), "mode persisted under analysisMode");
  assert.ok(composerSrc.includes('s.analysisMode === "normie" ? "normie" : "meme"'),
    "absent or unknown mode keeps MEME (default for existing users)");
  assert.ok(composerSrc.includes("msg.questions = Q.normieApi()"),
    "NORMIE requests carry the 50-question set");
  assert.ok(composerSrc.includes("makeModeRow"), "switch built with the panel");
});

test("only setStatus, the mode spinner, the one-time grid build and the evidence list ever replace children", () => {
  const calls = [...composerSrc.matchAll(/\.replaceChildren\(/g)];
  assert.equal(calls.length, 6, "exactly six replaceChildren call sites");
  const statusSrc = composerSrc.slice(
    composerSrc.indexOf("function setStatus"),
    composerSrc.indexOf("function spinnerNode"));
  const loadSrc = composerSrc.slice(
    composerSrc.indexOf("function spinnerNode"),
    composerSrc.indexOf("function makeEvidence"));
  const evSrc = composerSrc.slice(
    composerSrc.indexOf("function showEvidence"),
    composerSrc.indexOf("function hideEvidence"));
  const buildSrc = composerSrc.slice(
    composerSrc.indexOf("function ensureGrid"),
    composerSrc.indexOf("function renderResult"));
  const renderSrc = composerSrc.slice(
    composerSrc.indexOf("function renderResult"),
    composerSrc.indexOf("async function analyze"));
  assert.equal((statusSrc.match(/replaceChildren\(/g) || []).length, 1,
    "status swaps slot content");
  assert.ok(/replaceChildren\(spinnerNode\(\)\)/.test(loadSrc),
    "a mode change swaps the bars for the spinner");
  assert.ok(/replaceChildren\(grid, ev\.wrap\)/.test(buildSrc),
    "the NORMIE grid build inserts bars and evidence once");
  assert.ok(/replaceChildren\(grid\)/.test(buildSrc),
    "the MEME grid build inserts bars only");
  assert.equal((buildSrc.match(/replaceChildren\(/g) || []).length, 2,
    "one build site per mode arm");
  assert.equal((evSrc.match(/replaceChildren\(/g) || []).length, 2,
    "evidence updates only its own list items (or the neutral line)");
  assert.ok(!renderSrc.includes("replaceChildren"), "renderResult updates in place only");
});

test("composer.js keeps the safe footer placement and 800 ms gate wiring", () => {
  assert.ok(composerSrc.includes('button[data-testid="tweetButtonInline"]'));
  assert.ok(composerSrc.includes('button[data-testid="tweetButton"]'));
  assert.ok(composerSrc.includes("insertBefore(panel, footer)"), "inserts before the footer child");
  assert.ok(composerSrc.includes("A.DEBOUNCE_MS"), "debounce constant from the analysis module");
  assert.ok(composerSrc.includes("staleGate()"), "token gate");
});

function cssRule(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = cssSrc.match(new RegExp(esc + "\\s*\\{"));
  assert.ok(m, `${sel} rule exists`);
  const open = cssSrc.indexOf("{", m.index);
  return cssSrc.slice(open + 1, cssSrc.indexOf("}", open));
}

test("CSS pins the 3-column grid (two rows of three) and drops radar styles", () => {
  assert.ok(cssSrc.includes(".xjc-grid"), "grid class styled");
  assert.ok(cssRule(".xjc-grid").includes("repeat(3, 1fr)"), "three columns");
  assert.ok(cssSrc.includes(".xjc-tile"), "tile styled");
  assert.ok(!/radar/i.test(cssSrc), "no radar styles");
});

test("CSS parks the one switch top-right, above the bars, rocket left, puking face right", () => {
  const mode = cssRule(".xjc-mode");
  assert.ok(/display:\s*flex/.test(mode), "flex row");
  assert.ok(/justify-content:\s*flex-end/.test(mode), "right-aligned");
  assert.ok(/margin-bottom/.test(mode), "sits above the bars");
  assert.ok(!/margin-top/.test(mode), "nothing pushes it below the top line");
  const sw = cssRule(".xjc-switch");
  assert.ok(/display:\s*inline-flex/.test(sw), "one compact control");
  assert.ok(/border:\s*1px solid #536471/.test(sw), "outlined, X dark style");
  assert.ok(/border-radius:\s*9999px/.test(sw), "compact pill");
  const opt = cssRule(".xjc-opt");
  assert.ok(/border-radius:\s*9999px/.test(opt), "segments rounded");
  // selected side blue, per aria-checked state
  assert.ok(cssSrc.includes('.xjc-switch[aria-checked="true"] .xjc-opt-normie'),
    "NORMIE side blue when checked");
  assert.ok(cssSrc.includes('.xjc-switch[aria-checked="false"] .xjc-opt-meme'),
    "MEME side blue when unchecked");
  const selected = cssSrc.slice(cssSrc.indexOf('.xjc-switch[aria-checked="true"]'));
  assert.ok(selected.includes("#1d9bf0"), "selected side uses X blue");
  assert.ok(!cssSrc.includes(".xjc-mode-btn"), "no standalone button styles left");
});

test("CSS keeps no outer card chrome: one straight 1px top line only", () => {
  const panel = cssRule(".xjc-panel");
  assert.ok(/border-top:\s*1px solid #2f3336/.test(panel), "a single 1px top line");
  for (const gone of ["background", "border-radius", "box-shadow", "border-left",
    "border-right", "border-bottom"]) {
    assert.ok(!panel.includes(gone), `${gone} removed from .xjc-panel`);
  }
  assert.ok(!/border:/.test(panel), "no full border shorthand left");
  assert.ok(panel.includes("color:"), "label color kept for readability");
});

test("CSS ships a small centered spinner for the mode-change load", () => {
  const load = cssRule(".xjc-load");
  assert.ok(/justify-content:\s*center/.test(load), "spinner centered where the bars were");
  assert.ok(/min-height/.test(load), "holds the bars' place");
  const spin = cssRule(".xjc-spinner");
  assert.ok(/animation:\s*xjc-spin/.test(spin), "spins");
  assert.ok(/width:\s*14px/.test(spin), "small");
  assert.ok(cssSrc.includes("@keyframes xjc-spin"), "spin keyframes present");
});

test("CSS styles the NORMIE evidence list: green and red dots, hidden state", () => {
  const ev = cssRule(".xjc-evidence");
  assert.ok(/margin-top/.test(ev), "sits below the six bars");
  assert.ok(cssSrc.includes(".xjc-evidence[hidden]"), "collapses when hidden");
  assert.ok(cssRule(".xjc-evidence-list").includes("list-style: none"), "a clean list");
  assert.ok(/display:\s*flex/.test(cssRule(".xjc-evidence-item")), "items are rows");
  const dot = cssRule(".xjc-dot");
  assert.ok(/width:\s*6px/.test(dot), "small dot");
  assert.ok(/border-radius:\s*50%/.test(dot), "round dot");
  assert.ok(/background:\s*#00ba7c/.test(cssRule(".xjc-ev-pos .xjc-dot")),
    "green dot for a positive contribution");
  assert.ok(/background:\s*#f4212e/.test(cssRule(".xjc-ev-neg .xjc-dot")),
    "red dot for a penalty");
  assert.ok(/background:\s*#71767b/.test(cssRule(".xjc-ev-neutral .xjc-dot")),
    "grey dot for a neutral point");
  assert.ok(/color:\s*#71767b/.test(cssRule(".xjc-ev-neutral")),
    "grey text for a neutral point");
});

test("composer.js wires NORMIE evidence with DOM APIs and ARIA only", () => {
  assert.ok(composerSrc.includes('"xjc-evidence"'), "evidence wrapper class");
  assert.ok(composerSrc.includes("xjc-evidence-item "), "evidence item class");
  assert.ok(composerSrc.includes("makeEvidence"), "evidence built with the grid");
  assert.ok(composerSrc.includes("wireEvidence"), "hover/focus wiring exists");
  assert.ok(composerSrc.includes('setAttribute("role", "region")'), "evidence is a region");
  assert.ok(composerSrc.includes("Evidence for "), "per-label aria-label");
  assert.ok(composerSrc.includes('"xjc-ev-pos"'), "positive item class");
  assert.ok(composerSrc.includes('"xjc-ev-neg"'), "penalty item class");
  assert.ok(composerSrc.includes('"xjc-ev-neutral"'), "neutral item class");
  // evidence only ships in NORMIE grids: both branch arms are inside ensureGrid
  const buildSrc = composerSrc.slice(
    composerSrc.indexOf("function ensureGrid"),
    composerSrc.indexOf("function renderResult"));
  assert.ok(buildSrc.includes("ev.wrap"), "the NORMIE arm attaches evidence");
  assert.ok(buildSrc.includes("ev: null"), "the MEME arm builds none");
  assert.ok(buildSrc.indexOf("ev.wrap") < buildSrc.indexOf("ev: null"),
    "NORMIE arm first, MEME arm second");
});

test("composer.js keeps the empty-draft collapse and first-result expansion", () => {
  assert.ok(composerSrc.includes("el.hidden = true; // empty draft"),
    "the panel starts collapsed");
  assert.ok(composerSrc.includes("panel.hidden = false; // the first successful result expands the panel"),
    "the first successful result expands it");
  assert.ok(composerSrc.includes("shownOnce"), "first-expansion tracked");
  assert.ok(composerSrc.includes("&& shownOnce"), "the reading line waits for a prior expansion");
  assert.ok(composerSrc.includes("if (!readDraft(editor))"),
    "empty input hides the panel without waiting for a new request");
});

test("no per-tile card chrome: background, border, radius and padding gone", () => {
  const tile = cssRule(".xjc-tile");
  for (const gone of ["background", "border", "padding", "box-shadow"]) {
    assert.ok(!tile.includes(gone), `${gone} removed from .xjc-tile`);
  }
  assert.ok(tile.includes("flex"), "tile stays a flex stack");
  assert.ok(cssRule(".xjc-grid").includes("repeat(3, 1fr)"), "the grid remains");
});

test("share bar is 7px tall, full tile width, with a smooth width transition", () => {
  const bar = cssRule(".xjc-tile-bar");
  assert.ok(/height:\s*7px/.test(bar), "height is exactly 7px");
  assert.ok(!/height:\s*5px/.test(bar), "old 5px height gone");
  assert.ok(/width:\s*100%/.test(bar), "bar keeps the full tile width");
  const fill = cssRule(".xjc-tile-bar i");
  assert.ok(/transition:[^;]*\bwidth\b/.test(fill), "fill width transitions smoothly");
});

test("manifest keeps the composer modules at 0.0.3", () => {
  const m = JSON.parse(read("manifest.json"));
  assert.equal(m.version, "0.0.3");
  const js = m.content_scripts[0].js;
  for (const f of ["content.js", "composer-questions.js", "composer-analysis.js", "composer.js"]) {
    assert.ok(js.includes(f), `${f} still loaded`);
  }
});

// ---- 7. debounce and stale results ----

test("DEBOUNCE_MS is the quiet period the composer uses", () => {
  assert.equal(A.DEBOUNCE_MS, 800);
});

test("debounce fires once after quiet period; cancel drops it", async () => {
  let calls = 0;
  const fn = () => calls++;
  const d = A.debounce(fn, 30);
  d(); d(); d();
  await sleep(10);
  assert.equal(calls, 0, "still inside the window");
  await sleep(40);
  assert.equal(calls, 1, "fired exactly once");
  d();
  d.cancel();
  await sleep(50);
  assert.equal(calls, 1, "cancelled call never fired");
});

test("debounce: new input during the window cancels the pending run; latest text wins", async () => {
  const seen = [];
  const d = A.debounce((t) => seen.push(t), 25);
  d("hel");
  await sleep(10);
  d("hell");
  await sleep(10);
  d("hello");
  await sleep(50);
  assert.deepEqual(seen, ["hello"], "only the latest input analyzed");
});

test("staleGate: bumped tokens are stale; only the current request may render", async () => {
  const g = A.staleGate();
  const rendered = [];
  const render = (token, text) => { if (g.current(token)) rendered.push(text); };

  const t1 = g.take(); // analysis for "hel" fired
  g.bump();            // the user typed again during the request
  render(t1, "hel");   // its reply arrives late
  assert.deepEqual(rendered, [], "stale reply dropped");

  const t2 = g.take(); // next quiet period re-analyzed "hello"
  render(t2, "hello");
  assert.deepEqual(rendered, ["hello"], "current reply rendered");
});

// ---- 8. live DOM harness: the real panel script on a stub X page ----
// A tiny element tree plus selector engine is enough to run composer.js
// itself (no browser): it proves placement, bar-first tiles, in-place
// updates, the kept-visible grid during new requests, the mode toggle,
// and stale drops. The debounce is sped to 40 ms; the pure tests above
// still pin 800 ms.

const FAST_MS = 40;

// Frame stub: composer.js paints a freshly built grid's zero fills for
// one frame and moves to the results on the next, so the width
// transition animates from zero. The harness captures those frames;
// flushFrames(1) steps exactly one frame, flushFrames() drains all.
const rafQueue = [];
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
function flushFrames(count = Infinity) {
  let left = count;
  while (rafQueue.length && left > 0) {
    const frame = rafQueue.splice(0);
    for (const fn of frame) fn();
    left--;
  }
}

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    type: "",
    id: "",
    className: "",
    children: [],
    parentElement: null,
    attributes: {},
    style: { setProperty(k, v) { this[k] = v; } },
    hidden: false,
    textContent: "",
    innerText: "",
    listeners: {},
    get isConnected() {
      let n = el;
      while (n.parentElement) n = n.parentElement;
      return n._root === true;
    },
    get nextElementSibling() {
      const sibs = el.parentElement ? el.parentElement.children : [];
      const i = sibs.indexOf(el);
      return i >= 0 ? (sibs[i + 1] || null) : null;
    },
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return k in el.attributes ? el.attributes[k] : null; },
    append(...nodes) { for (const n of nodes) { n.parentElement = el; el.children.push(n); } },
    insertBefore(node, ref) {
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i >= 0) el.children.splice(i, 0, node); else el.children.push(node);
      node.parentElement = el;
      return node;
    },
    replaceChildren(...nodes) {
      for (const c of el.children) c.parentElement = null;
      el.children = nodes.slice();
      for (const n of nodes) n.parentElement = el;
    },
    remove() {
      if (!el.parentElement) return;
      const sibs = el.parentElement.children;
      sibs.splice(sibs.indexOf(el), 1);
      el.parentElement = null;
    },
    contains(x) { let n = x; while (n) { if (n === el) return true; n = n.parentElement; } return false; },
    matches(sel) { return matchesSelector(el, sel); },
    querySelector(sel) { return findAll(el, sel)[0] || null; },
    querySelectorAll(sel) { return findAll(el, sel); },
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      el.listeners[type] = (el.listeners[type] || []).filter((f) => f !== fn);
    },
    dispatchEvent(type) { for (const fn of [...(el.listeners[type] || [])]) fn({}); },
  };
  return el;
}

function matchesCompound(el, compound) {
  const units = compound.match(/[a-zA-Z][a-zA-Z0-9-]*|#[A-Za-z0-9_-]+|\.[A-Za-z0-9_-]+|\[[^\]]+\]/g) || [];
  for (const u of units) {
    if (u[0] === "#") { if (el.id !== u.slice(1)) return false; }
    else if (u[0] === ".") { if (!(el.className || "").split(/\s+/).includes(u.slice(1))) return false; }
    else if (u[0] === "[") {
      const m = u.match(/^\[([A-Za-z-]+)(?:="([^"]*)")?\]$/);
      if (!m) return false;
      const attr = el.getAttribute(m[1]);
      if (m[2] === undefined) { if (attr === null) return false; }
      else if (attr !== m[2]) return false;
    } else if ((el.tagName || "").toLowerCase() !== u.toLowerCase()) return false;
  }
  return true;
}

function matchesAlt(el, alt) {
  const parts = alt.trim().split(/\s+/).filter(Boolean);
  if (!matchesCompound(el, parts[parts.length - 1])) return false;
  let i = parts.length - 2;
  for (let n = el.parentElement; n && i >= 0; n = n.parentElement) {
    if (matchesCompound(n, parts[i])) i--;
  }
  return i < 0;
}

function matchesSelector(el, sel) {
  return sel.split(",").map((s) => s.trim()).filter(Boolean).some((alt) => matchesAlt(el, alt));
}

function findAll(rootEl, sel) {
  const out = [];
  const visit = (n) => { if (matchesSelector(n, sel)) out.push(n); n.children.forEach(visit); };
  visit(rootEl);
  return out;
}

function makeDoc() {
  const body = makeEl("body");
  body._root = true;
  const doc = {
    body,
    listeners: {},
    createElement: (tag) => makeEl(tag),
    addEventListener(type, fn) { (doc.listeners[type] = doc.listeners[type] || []).push(fn); },
    querySelector: (sel) => findAll(body, sel)[0] || null,
    querySelectorAll: (sel) => findAll(body, sel),
  };
  return doc;
}

function makeChrome(store = { enabled: true, sentimentEnabled: true }) {
  const inbox = [];
  const sets = [];
  return {
    inbox, sets, store,
    runtime: {
      sendMessage: (msg) => new Promise((resolve) => inbox.push({ msg, resolve })),
    },
    storage: {
      local: {
        get: async () => ({ ...store }),
        set: async (obj) => { sets.push(obj); Object.assign(store, obj); },
      },
      onChanged: { addListener() {} },
    },
  };
}

class FakeObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
}

function boot(chromeApi) {
  const doc = makeDoc();
  const xhc = chromeApi || makeChrome();
  globalThis.XJevComposerQuestions = Q;
  globalThis.XJevComposerAnalysis = Object.assign(Object.create(null), A, { DEBOUNCE_MS: FAST_MS });
  new Function("document", "MutationObserver", "chrome", composerSrc)(doc, FakeObserver, xhc);
  return { doc, chrome: xhc };
}

// A minimal X composer: host div holds the editor area (Draft.js stub) and
// a footer with the Post button — the shape placePanel() targets.
function xcomposer(doc) {
  const host = makeEl("div");
  const editorArea = makeEl("div");
  const editor = makeEl("div");
  editor.setAttribute("data-testid", "tweetTextarea_0");
  editor.setAttribute("role", "textbox");
  editorArea.append(editor);
  const footer = makeEl("div");
  const postBtn = makeEl("button");
  postBtn.setAttribute("data-testid", "tweetButtonInline");
  footer.append(postBtn);
  host.append(editorArea, footer);
  doc.body.append(host);
  return { host, editor, footer };
}

function typeDraft(doc, editor, text) {
  editor.innerText = text;
  for (const fn of doc.listeners.input || []) fn({ target: editor });
}

test("live panel: placed before the footer, six bar-first tiles, switch above", async () => {
  const { doc, chrome: xhc } = boot();
  const { host, editor, footer } = xcomposer(doc);
  await sleep(5); // storage flags load
  typeDraft(doc, editor, "gm, send 0.5 ETH to double your money");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 1, "one request after the quiet period");
  assert.equal(xhc.inbox[0].msg.type, "composerAnalyze");
  assert.equal(xhc.inbox[0].msg.mode, "meme", "defaults to MEME");
  assert.ok(!("questions" in xhc.inbox[0].msg), "meme carries no question payload");

  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);

  const panel = doc.querySelector("div#xjc-panel");
  assert.ok(panel, "panel exists");
  assert.equal(panel.hidden, false, "panel visible");
  assert.equal(panel.parentElement, host, "panel inside the composer host");
  assert.equal(panel.nextElementSibling, footer, "panel sits before the footer");
  assert.ok(!editor.contains(panel), "panel never inside the editor subtree");

  const pbody = panel.querySelector(".xjc-body");
  assert.equal(pbody.children.length, 2, "body holds the mode row and the slot");
  const modeRow = pbody.children[0];
  const slot = pbody.children[1];
  assert.equal(modeRow.className, "xjc-mode", "mode row first: top-right, above the bars");
  assert.equal(slot.className, "xjc-slot");

  const grid = slot.children[0];
  assert.equal(grid.className, "xjc-grid");
  assert.equal(grid.children.length, 6, "six tiles");
  assert.deepEqual(grid.children.map((t) => t.querySelector(".xjc-tile-name").textContent), [
    "💩 SHITPOST", "🎣 BAIT", "😬 CRINGE",
    "🤑 SHILLING", "🚀 PUMP", "😡 RAGE",
  ]);
  for (const tile of grid.children) {
    assert.equal(tile.children[0].className, "xjc-tile-bar", "bar first child");
    assert.equal(tile.children[1].className, "xjc-tile-name", "name second child");
    assert.equal(tile.children[0].children[0].tagName, "I", "fill inside the bar");
  }
  const bait = grid.children[tileIdx("bait")];
  assert.equal(bait.getAttribute("aria-valuenow"), "100");
  assert.equal(bait.getAttribute("aria-valuetext"), "100 of 100 points");
  assert.equal(bait.children[0].children[0].style.width, "100%");

  // ONE switch control above the bars: a single role=switch button,
  // rocket NORMIE left, puking-face MEME right, unchecked (MEME) by default
  assert.equal(modeRow.children.length, 1, "exactly one control in the mode row");
  const sw = modeRow.children[0];
  assert.equal(sw.tagName, "BUTTON", "the control is one button");
  assert.equal(sw.className, "xjc-switch");
  assert.equal(sw.getAttribute("role"), "switch");
  assert.equal(sw.getAttribute("aria-checked"), "false");
  assert.deepEqual(sw.children.map((o) => o.textContent), ["🚀 NORMIE", "🤮 MEME"]);
  assert.equal(sw.children[0].className, "xjc-opt xjc-opt-normie", "rocket NORMIE label left");
  assert.equal(sw.children[1].className, "xjc-opt xjc-opt-meme", "puking-face MEME label right");
});

test("live panel: retyping reuses the same grid and tiles; no loading swap", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "pure bait draft");
  await sleep(FAST_MS + 20);
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);

  const panel = doc.querySelector("div#xjc-panel");
  const pbody = panel.querySelector(".xjc-body");
  const modeRow = pbody.children[0];
  const grid = pbody.children[1].children[0];
  const tiles = grid.children.slice();
  const fills = tiles.map((t) => t.children[0].children[0]);
  assert.equal(tiles[tileIdx("bait")].getAttribute("aria-valuenow"), "100");

  typeDraft(doc, editor, "reply if you also want free money");
  await sleep(FAST_MS + 20); // second request in flight
  assert.equal(pbody.children.length, 2, "body untouched during the new request");
  assert.equal(pbody.children[0], modeRow, "switch kept visible");
  assert.equal(pbody.children[1].children[0], grid, "grid kept visible, no loading component");
  assert.ok(!pbody.children[1].querySelector(".xjc-status"), "no status node swapped in");
  assert.ok(!pbody.children[1].querySelector(".xjc-load"), "no spinner on a same-mode retype");
  assert.equal(xhc.inbox.length, 2, "a fresh request was sent");

  xhc.inbox[1].resolve({ answers: { type: { choice: "shitpost", probabilities: { shitpost: 1 } } } });
  await sleep(5);
  assert.equal(pbody.children[1].children[0], grid, "same grid element");
  assert.deepEqual(grid.children, tiles, "same six tile elements");
  assert.deepEqual(tiles.map((t) => t.children[0].children[0]), fills, "same six fill elements");
  const shitpost = tiles[tileIdx("shitpost")];
  assert.equal(shitpost.getAttribute("aria-valuenow"), "100", "shitpost now full");
  assert.equal(fills[tileIdx("shitpost")].style.width, "100%", "shitpost fill width moved");
  assert.equal(tiles[tileIdx("bait")].getAttribute("aria-valuenow"), "0", "bait emptied");
  assert.equal(fills[tileIdx("bait")].style.width, "0%", "bait fill width moved");
});

test("live panel: burst types once after the quiet period; stale replies never render", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "h");
  typeDraft(doc, editor, "he");
  typeDraft(doc, editor, "hel");
  await sleep(10);
  assert.equal(xhc.inbox.length, 0, "inside the debounce window nothing is sent");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 1, "exactly one request after the quiet period");

  typeDraft(doc, editor, "hello"); // invalidates the in-flight reply
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } }); // stale reply lands
  await sleep(5);
  const panel = doc.querySelector("div#xjc-panel");
  assert.ok(!panel.querySelector(".xjc-grid"), "stale reply rendered nothing");
  assert.equal(panel.hidden, true, "before the first successful result the panel stays collapsed");

  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 2, "the latest text was re-analyzed");
  xhc.inbox[1].resolve({ answers: { type: { choice: "shitpost", probabilities: { shitpost: 1 } } } });
  await sleep(5);
  assert.equal(panel.hidden, false, "the first successful result expands the panel");
  const grid = panel.querySelector(".xjc-grid");
  assert.ok(grid, "the current reply rendered");
  assert.equal(grid.children[tileIdx("shitpost")].getAttribute("aria-valuenow"), "100",
    "the latest response wins");
});

test("live panel: switching to NORMIE saves the mode, spins, then rebuilds bars from zero", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox[0].msg.mode, "meme");
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);

  const panel = doc.querySelector("div#xjc-panel");
  const pbody = panel.querySelector(".xjc-body");
  const modeRow = pbody.children[0];
  const slot = pbody.children[1];
  const oldGrid = slot.children[0];
  const sw = modeRow.children[0];
  assert.equal(sw.getAttribute("role"), "switch");

  sw.dispatchEvent("click");
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["normie"],
    "choice saved to chrome.storage.local as analysisMode");
  assert.equal(sw.getAttribute("aria-checked"), "true");
  // the bars leave at once, a spinner takes their place, the switch stays
  assert.ok(!slot.querySelector(".xjc-grid"), "the six bars left the slot");
  assert.equal(oldGrid.parentElement, null, "the old grid is detached at once");
  assert.ok(slot.querySelector(".xjc-load"), "loading wrap in the bars' place");
  assert.ok(slot.querySelector(".xjc-spinner"), "small spinner glyph shown");
  assert.equal(pbody.children[0], modeRow, "mode row kept visible during loading");
  assert.equal(modeRow.children[0], sw, "same switch element, never replaced");

  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 2, "a new request ran for the current draft");
  const msg = xhc.inbox[1].msg;
  assert.equal(msg.mode, "normie");
  assert.equal(msg.type, "composerAnalyze");
  assert.equal(Object.keys(msg.questions).length, 50, "the request carries exactly 50 NORMIE questions");
  assert.deepEqual(msg.questions, Q.normieApi(), "the NORMIE payload is the merged set");
  assert.ok(slot.querySelector(".xjc-load"), "spinner still up while the request runs");

  xhc.inbox[1].resolve({ answers: { p_share_send_on: { score: 3 } } });
  await sleep(5);
  const grid = slot.children[0];
  assert.equal(grid.className, "xjc-grid", "bars rebuilt after the response");
  assert.notEqual(grid, oldGrid, "a fresh grid, not the old bars");
  assert.equal(pbody.children[0], modeRow, "switch still on top after the rebuild");
  assert.deepEqual(grid.children.map((t) => t.querySelector(".xjc-tile-name").textContent), [
    "🎭 EMOTION", "💬 CONVERSATION", "📤 SHARE",
    "⏰ TIMELY", "✍️ CRAFT", "🪪 IDENTITY",
  ], "NORMIE family labels on the fresh bars");
  // the NORMIE grid ships with the evidence wrapper below it, collapsed
  assert.equal(slot.children.length, 2, "slot holds the grid and the evidence wrapper");
  const evWrap = slot.children[1];
  assert.equal(evWrap.className, "xjc-evidence");
  assert.equal(evWrap.hidden, true, "evidence collapsed until a label is hovered or focused");
  assert.equal(evWrap.getAttribute("role"), "region");
  for (const tile of grid.children) {
    assert.equal(tile.getAttribute("tabindex"), "0", "NORMIE tiles are focusable");
  }
  // zero-to-result animation: every fill begins at zero...
  const fills = grid.children.map((t) => t.children[0].children[0]);
  assert.deepEqual(fills.map((f) => f.style.width), ["0%", "0%", "0%", "0%", "0%", "0%"],
    "all fills begin at zero");
  assert.equal(grid.children[normieIdx("share")].getAttribute("aria-valuenow"), "0",
    "meter reads zero before the move");
  flushFrames(1); // frame one paints the zeros
  assert.equal(fills[normieIdx("share")].style.width, "0%", "still zero on the zero-paint frame");
  flushFrames(1); // frame two moves to the results
  assert.equal(grid.children[normieIdx("share")].getAttribute("aria-valuenow"), "100", "share full");
  assert.equal(fills[normieIdx("share")].style.width, "100%", "share fill animated to its result");
  assert.equal(grid.children[normieIdx("share")].getAttribute("aria-valuetext"), "100 of 100 points");
  assert.equal(fills[normieIdx("conversation")].style.width, "0%", "conversation stayed zero");
});

test("live panel: a mode switch invalidates the in-flight MEME reply", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 1, "meme request in flight");

  const sw = doc.querySelector("div#xjc-panel .xjc-mode").children[0];
  sw.dispatchEvent("click");
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } }); // stale reply lands
  await sleep(5);
  const panel = doc.querySelector("div#xjc-panel");
  assert.ok(!panel.querySelector(".xjc-grid"), "the old reply rendered nothing");
  assert.ok(panel.querySelector(".xjc-load"), "the spinner waits for the NORMIE reply");
  assert.equal(xhc.sets.length, 1, "mode still saved");

  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 2, "the draft was re-read in NORMIE mode");
  assert.equal(xhc.inbox[1].msg.mode, "normie");
  xhc.inbox[1].resolve({ answers: { p_time_news_anchor: { noul: 1 } } });
  await sleep(5);
  flushFrames(); // run the zero-to-result animation to its end
  const grid = panel.querySelector(".xjc-grid");
  assert.ok(grid, "the NORMIE reply rendered");
  assert.equal(grid.children[normieIdx("timely")].getAttribute("aria-valuenow"), "100",
    "the TIMELY family tile carries the reading");
});

test("live panel: stored analysisMode 'normie' boots in NORMIE mode", async () => {
  const { doc, chrome: xhc } = boot(makeChrome({ enabled: true, sentimentEnabled: true, analysisMode: "normie" }));
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "wen moon");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 1);
  const msg = xhc.inbox[0].msg;
  assert.equal(msg.mode, "normie");
  assert.equal(Object.keys(msg.questions).length, 50);
  const modeRow = doc.querySelector("div#xjc-panel .xjc-mode");
  assert.equal(modeRow.children[0].getAttribute("aria-checked"), "true");

  xhc.inbox[0].resolve({ answers: { p_identity_outgroup: { noul: 1 } } });
  await sleep(5);
  const grid = doc.querySelector(".xjc-grid");
  assert.deepEqual(grid.children.map((t) => t.querySelector(".xjc-tile-name").textContent), [
    "🎭 EMOTION", "💬 CONVERSATION", "📤 SHARE",
    "⏰ TIMELY", "✍️ CRAFT", "🪪 IDENTITY",
  ]);
  assert.equal(grid.children[normieIdx("identity")].getAttribute("aria-valuenow"), "100");
});

test("live panel: the switch flips both ways; every flip spins, saves and rebuilds", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);
  assert.equal(xhc.inbox.length, 1);

  const panel = doc.querySelector("div#xjc-panel");
  const firstGrid = panel.querySelector(".xjc-grid");
  const sw = panel.querySelector(".xjc-mode").children[0];

  sw.dispatchEvent("click"); // -> NORMIE
  assert.ok(panel.querySelector(".xjc-load"), "spinner in on the flip");
  assert.ok(!panel.querySelector(".xjc-grid"), "bars gone on the flip");
  await sleep(FAST_MS + 20);
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["normie"]);
  assert.equal(sw.getAttribute("aria-checked"), "true");
  assert.equal(xhc.inbox.length, 2);
  assert.equal(xhc.inbox[1].msg.mode, "normie");
  xhc.inbox[1].resolve({ answers: { p_craft_credential: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  const normieGrid = panel.querySelector(".xjc-grid");
  assert.notEqual(normieGrid, firstGrid, "NORMIE built a fresh grid from zero");
  assert.equal(normieGrid.children[normieIdx("craft")].getAttribute("aria-valuenow"), "100");

  sw.dispatchEvent("click"); // -> MEME again
  assert.ok(panel.querySelector(".xjc-load"), "spinner in on the flip back");
  assert.ok(!panel.querySelector(".xjc-grid"), "NORMIE bars gone on the flip back");
  await sleep(FAST_MS + 20);
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["normie", "meme"]);
  assert.equal(sw.getAttribute("aria-checked"), "false");
  assert.equal(xhc.inbox.length, 3);
  assert.equal(xhc.inbox[2].msg.mode, "meme");
  assert.ok(!("questions" in xhc.inbox[2].msg), "meme carries no question payload");
  xhc.inbox[2].resolve({ answers: { is_pump: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  const memeGrid = panel.querySelector(".xjc-grid");
  assert.notEqual(memeGrid, normieGrid, "grid rebuilt again on the flip back");
  assert.deepEqual(memeGrid.children.map((t) => t.querySelector(".xjc-tile-name").textContent), [
    "💩 SHITPOST", "🎣 BAIT", "😬 CRINGE",
    "🤑 SHILLING", "🚀 PUMP", "😡 RAGE",
  ], "labels flipped back to the MEME tags");
  assert.equal(memeGrid.children[tileIdx("pump")].getAttribute("aria-valuenow"), "100");
});

test("live panel: NORMIE evidence opens on hover, replaces per label, collapses on leave", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);
  doc.querySelector("div#xjc-panel .xjc-mode").children[0].dispatchEvent("click"); // -> NORMIE
  await sleep(FAST_MS + 20);
  xhc.inbox[1].resolve({
    answers: {
      p_share_send_on: { score: 3 },
      p_format_quote_dependence: { noul: 0.5 },
      p_emotion_relatable: { score: 3 },
    },
  });
  await sleep(5);
  flushFrames();

  const panel = doc.querySelector("div#xjc-panel");
  const grid = panel.querySelector(".xjc-grid");
  const evWrap = panel.querySelector(".xjc-evidence");
  assert.ok(evWrap, "evidence wrapper sits below the bars");
  assert.equal(evWrap.hidden, true, "collapsed before any hover or focus");
  const title = evWrap.children[0];
  const list = evWrap.children[1];

  // hover SHARE: green, grey and red points stay visible in mapping order
  grid.children[normieIdx("share")].dispatchEvent("mouseenter");
  assert.equal(evWrap.hidden, false, "hover opens the evidence");
  assert.equal(title.textContent, "📤 SHARE");
  assert.equal(evWrap.getAttribute("aria-label"), "Evidence for SHARE");
  assert.deepEqual(list.children.map((li) => li.className), [
    "xjc-evidence-item xjc-ev-pos",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neutral",
    "xjc-evidence-item xjc-ev-neg",
  ], "green, grey and red point states");
  assert.equal(list.children[0].children[0].className, "xjc-dot", "the dot node");
  assert.equal(list.children[0].children[1].textContent, "People would send it on");
  assert.equal(list.children[7].children[1].textContent, "Needs the image or quote to make sense");
  // pos 1 scaled by the 0.5 penalty -> the meter reads 50
  assert.equal(grid.children[normieIdx("share")].getAttribute("aria-valuenow"), "50");
  const shareItems = list.children.slice();

  // hover EMOTION: same wrapper, title and list nodes, contents replaced
  grid.children[normieIdx("emotion")].dispatchEvent("mouseenter");
  assert.equal(evWrap.hidden, false, "still open for the newly hovered label");
  assert.equal(title.textContent, "🎭 EMOTION");
  assert.equal(list.children.length, 11, "all emotion points stay visible");
  assert.ok(list.children.some((li) => li.children[1].textContent === "An experience readers recognize"),
    "the active positive point remains visible");
  assert.ok(list.children.some((li) => li.className === "xjc-evidence-item xjc-ev-neutral"),
    "unanswered emotion points are grey");
  assert.notEqual(list.children[0], shareItems[0], "items replaced, not mutated");

  // moving from the grid into the evidence area keeps it open
  grid.dispatchEvent("mouseleave");
  evWrap.dispatchEvent("mouseenter"); // cancels the queued hide
  flushFrames();
  assert.equal(evWrap.hidden, false, "entering the evidence area cancels the collapse");
  evWrap.dispatchEvent("mouseleave");
  assert.equal(evWrap.hidden, false, "the queued hide waits one frame");
  flushFrames();
  assert.equal(evWrap.hidden, true, "leaving the evidence area collapses it");

  // focus opens it for a label with nothing active: every point is neutral
  grid.children[normieIdx("craft")].dispatchEvent("focus");
  assert.equal(evWrap.hidden, false, "focus opens the evidence");
  assert.equal(title.textContent, "✍️ CRAFT");
  assert.equal(list.children.length, 11, "craft points remain visible");
  assert.ok(list.children.every((li) => li.className === "xjc-evidence-item xjc-ev-neutral"),
    "an untouched label is fully grey");
  grid.children[normieIdx("craft")].dispatchEvent("blur");
  flushFrames();
  assert.equal(evWrap.hidden, true, "blur collapses the evidence");
});

test("live panel: MEME never shows the NORMIE evidence list", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);
  const panel = doc.querySelector("div#xjc-panel");
  const grid = panel.querySelector(".xjc-grid");
  assert.ok(!panel.querySelector(".xjc-evidence"), "no evidence wrapper in MEME");
  assert.equal(panel.querySelector(".xjc-slot").children.length, 1, "MEME slot holds only the grid");
  assert.equal(grid.children[0].getAttribute("tabindex"), null, "MEME tiles are not focusable");

  // hover- and focus-like events on MEME tiles never create one
  grid.children[0].dispatchEvent("mouseenter");
  grid.children[0].dispatchEvent("focus");
  grid.dispatchEvent("mouseleave");
  flushFrames();
  assert.ok(!panel.querySelector(".xjc-evidence"), "still no evidence after MEME events");

  // NORMIE gets the wrapper; flipping back to MEME removes it again
  panel.querySelector(".xjc-mode").children[0].dispatchEvent("click"); // -> NORMIE
  await sleep(FAST_MS + 20);
  xhc.inbox[1].resolve({ answers: { p_time_news_anchor: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  assert.ok(panel.querySelector(".xjc-evidence"), "NORMIE carries the evidence wrapper");
  panel.querySelector(".xjc-mode").children[0].dispatchEvent("click"); // -> MEME
  await sleep(FAST_MS + 20);
  xhc.inbox[2].resolve({ answers: { is_pump: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  assert.ok(!panel.querySelector(".xjc-evidence"), "back on MEME the evidence is gone");
});

test("live panel: empty draft collapses the whole panel; the first result expands it", async () => {
  const { doc, chrome: xhc } = boot();
  const { editor } = xcomposer(doc);
  await sleep(5);
  // empty composer: nothing of the analyzer is visible, switch included
  const dormant = doc.querySelector("div#xjc-panel");
  assert.ok(!dormant || dormant.hidden, "no visible panel with no draft text");

  typeDraft(doc, editor, "gm");
  await sleep(FAST_MS + 20);
  const panel = doc.querySelector("div#xjc-panel");
  assert.ok(panel, "panel created for the draft");
  assert.equal(panel.hidden, true, "still collapsed while the first request runs");
  assert.ok(panel.querySelector("#xjc-mode-switch"), "the switch sits inside the hidden panel");
  assert.equal(xhc.inbox.length, 1);

  xhc.inbox[0].resolve({ answers: { is_bait: { noul: 1 } } });
  await sleep(5);
  assert.equal(panel.hidden, false, "the first successful result expands the panel");
  assert.ok(panel.querySelector(".xjc-grid"), "bars visible after the first result");

  // clearing the draft collapses everything again, switch and bars included
  typeDraft(doc, editor, "   ");
  assert.equal(panel.hidden, true, "clearing the draft hides the panel immediately");
  await sleep(FAST_MS + 20);
  assert.equal(panel.hidden, true, "a whitespace-only draft collapses the panel");

  // typing again re-expands on the new result
  typeDraft(doc, editor, "gm again");
  await sleep(FAST_MS + 20);
  xhc.inbox[1].resolve({ answers: { is_pump: { noul: 1 } } });
  await sleep(5);
  assert.equal(panel.hidden, false, "the next result expands it again");
  assert.equal(panel.querySelector(".xjc-grid").children[tileIdx("pump")]
    .getAttribute("aria-valuenow"), "100");
});

// ---- 1000-probe calibration: bounded weights, coverage, direction ----

// The calibration lowered exactly these mapping points, using a synthetic
// 1000-probe benchmark (20 probes per question). Every calibrated weight
// must stay inside 0.4..1.0 and must sit at its calibrated value.
const CALIBRATED = [
  // positive entry weights (explicit w)
  ["emotion", "p_emotion_humour_twist", "w", 0.7],
  ["emotion", "p_emotion_relatable", "w", 0.5],
  ["conversation", "p_conv_easy_answer", "w", 0.4],
  ["conversation", "p_conv_contestable", "w", 0.6],
  ["share", "p_share_stands_alone", "w", 0.5],
  ["share", "p_share_quotable", "w", 0.5],
  ["craft", "p_craft_specific", "w", 0.4],
  ["craft", "p_craft_micro_anecdote", "w", 0.5],
  // choice option weights
  ["emotion", "p_emotion_dominant", "curiosity", 0.4],
  ["conversation", "p_conv_question_kind", "help", 0.6],
  ["conversation", "p_conv_reply_forecast", "jokes", 0.8],
  // penalty strengths
  ["p_anti_ai_slop", "craft", 0.6],
  ["p_anti_empty_words", "craft", 0.5],
  ["p_anti_empty_words", "emotion", 0.5],
  ["p_format_reused_template", "craft", 0.6],
];

test("calibrated weights sit at their calibrated values and stay in 0.4..1.0", () => {
  for (const c of CALIBRATED) {
    if (c.length === 4) {
      const [labelId, qId, kind, expected] = c;
      if (kind === "w") {
        const e = A.NORMIE_POSITIVES[labelId].find((e) => e.id === qId);
        assert.ok(e, `${qId} maps to ${labelId}`);
        assert.equal(e.w, expected, `${qId} entry weight on ${labelId}`);
      } else {
        const e = A.NORMIE_POSITIVES[labelId].find((e) => e.id === qId);
        assert.ok(e && e.options, `${qId} maps options to ${labelId}`);
        assert.equal(e.options[kind], expected, `${qId} option ${kind} on ${labelId}`);
      }
    } else {
      const [pId, labelId, expected] = c;
      const p = A.NORMIE_PENALTIES.find((p) => p.id === pId);
      assert.ok(p, `${pId} is a penalty`);
      assert.equal(p.strengths[labelId], expected, `${pId} strength on ${labelId}`);
    }
  }
  // every explicit entry weight and every penalty strength is bounded
  for (const list of Object.values(A.NORMIE_POSITIVES)) {
    for (const e of list) {
      if (e.w !== undefined) {
        assert.ok(e.w >= 0.4 && e.w <= 1, `${e.id} entry weight ${e.w} in 0.4..1.0`);
      }
    }
  }
  for (const p of A.NORMIE_PENALTIES) {
    for (const s of Object.values(p.strengths)) {
      assert.ok(s >= 0.4 && s <= 1, `${p.id} strength ${s} in 0.4..1.0`);
    }
  }
});

test("calibration left the mapping complete: 50 questions, six labels, 10 choice sets, 9 anti-signals", () => {
  const mapped = new Set([
    ...Object.values(A.NORMIE_POSITIVES).flatMap((l) => l.map((e) => e.id)),
    ...A.NORMIE_PENALTIES.map((p) => p.id),
  ]);
  for (const id of Q.NORMIE_IDS) assert.ok(mapped.has(id), `${id} still mapped`);
  assert.equal(Object.keys(A.NORMIE_POSITIVES).length, 6, "six labels keep positives");
  assert.equal(A.NORMIE_PENALTIES.filter((p) => p.id.startsWith("p_anti_")).length, 9,
    "all nine ANTI-SIGNAL penalties remain");
  const choiceIds = Object.values(A.NORMIE_POSITIVES)
    .flatMap((l) => l.filter((e) => e.options).map((e) => e.id));
  assert.equal(new Set(choiceIds).size, 10, "all 10 choice option sets remain routed");
});

function normieNorm(values, choices) {
  const raw = {};
  for (const [id, v] of Object.entries(values)) {
    const q = Q.NORMIE_QUESTIONS[id];
    // v is the normalized 0..1 level; score answers go back on their
    // 0..max raw scale so normalizeAnswers divides by max again.
    raw[id] = q.type === "score"
      ? { score: v * (Math.max(2, (q.criteria || []).length) - 1) }
      : { noul: v };
  }
  for (const [id, c] of Object.entries(choices || {})) raw[id] = c;
  return A.normalizeAnswers(raw, Q.NORMIE_QUESTIONS);
}

test("calibrated direction: strong points outweigh weak ones and penalties still bite", () => {
  // With one mid-level craft point, adding a full weak point dilutes the
  // weighted mean less than adding a full strong point.
  const strong = A.normieLabelScore("craft",
    normieNorm({ p_craft_economy: 0.5, p_craft_first_line: 1 }));
  const weak = A.normieLabelScore("craft",
    normieNorm({ p_craft_economy: 0.5, p_craft_specific: 1 }));
  assert.ok(strong.score > weak.score, "strong pair outscores pair with weak specific point");
  assert.equal(strong.score, 75);
  assert.equal(weak.score, 64);

  // A penalty still pulls a label down against positive evidence.
  const clean = A.normieLabelScore("conversation",
    normieNorm({ p_conv_reader_gap: 1 }));
  const farmed = A.normieLabelScore("conversation",
    normieNorm({ p_conv_reader_gap: 1, p_anti_reply_farm: 1 }));
  assert.ok(farmed.score < clean.score, "reply-farm penalty lowers conversation");

  // A confident choice option contributes more than a weak calibrated one.
  const amused = A.normieLabelScore("emotion", normieNorm({}, {
    p_emotion_dominant: { choice: "amusement", probabilities: { amusement: 1 } },
  }));
  const curious = A.normieLabelScore("emotion", normieNorm({}, {
    p_emotion_dominant: { choice: "curiosity", probabilities: { curiosity: 1 } },
  }));
  assert.ok(amused.score > curious.score, "amusement outscores calibrated curiosity");
  assert.equal(curious.score, 40);
});

// ---- runner ----

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}\n     ${e.message}`);
    }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
