// Focused harness for the composer tag panel.
// Run: node tests/composer.test.js   (plain Node, no dependencies)
// Covers: classifier question-set parity with background.js, the merged
// 50-question PRO set and its source coverage, answer normalization, the six
// MEME tag tiles and the six PRO family tiles in exact order, the
// 100-point distribution, layout classes (no card chrome around the
// panel except a 1px top line, no tile cards, 7px bar above the label,
// one semantic mode switch top-right with rocket/puking-face labels, a
// mode-change spinner), in-place grid updates via a DOM harness, the
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

test("meme and pro question ids are unique", () => {
  assert.equal(new Set(Q.IDS).size, Q.IDS.length);
  assert.equal(new Set(Q.PRO_IDS).size, Q.PRO_IDS.length);
});

test("background composer request picks the question set by mode", () => {
  const block = bgSrc.slice(bgSrc.indexOf("composerAnalyze"));
  assert.ok(block.includes('msg.mode === "pro"'), "PRO detected from the message");
  assert.ok(/questions,\s*\n/.test(block), "composer payload uses the chosen set");
  assert.ok(bgSrc.includes("questions: QUESTIONS,"), "feed payload still sends QUESTIONS");
  assert.ok(!bgSrc.includes("XJevComposerQuestions"), "no side module in the worker");
});

// ---- 2. PRO set: exactly 50 questions merged from the source set ----

test("PRO set: exactly 50 questions, 10 choice / 28 noul / 12 score", () => {
  assert.equal(Q.PRO_COUNT, 50);
  assert.deepEqual(Q.PRO_KINDS, { choice: 10, noul: 28, score: 12 });
  assert.deepEqual(Q.proApi(), Q.PRO_QUESTIONS);
  assert.deepEqual(Q.questionsFor("pro"), Q.PRO_QUESTIONS);
});

test("every PRO question is well-formed", () => {
  for (const [id, q] of Object.entries(Q.PRO_QUESTIONS)) {
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

test("source coverage: PRO_META matches the PRO ids exactly, in order", () => {
  assert.deepEqual(Q.PRO_META.map((m) => m.id), Object.keys(Q.PRO_QUESTIONS));
  for (const m of Q.PRO_META) {
    assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, `${m.id} has sources`);
    assert.equal(typeof m.family, "string", `${m.id} has a family`);
  }
});

test("source coverage: all 61 source ids covered once, 11 merges, 50 questions", () => {
  const flat = Q.PRO_META.flatMap((m) => m.sources);
  assert.equal(flat.length, 61, "61 sources total");
  assert.equal(new Set(flat).size, 61, "no source id used twice");
  assert.deepEqual([...new Set(flat)].sort(), [...new Set(Q.PRO_SOURCE_IDS)].sort(),
    "sources are exactly the recovered source set");
  assert.equal(new Set(Q.PRO_SOURCE_IDS).size, 61, "PRO_SOURCE_IDS pins 61 ids");
  assert.equal(Q.PRO_META.filter((m) => m.sources.length > 1).length, 11,
    "11 merged questions");
  assert.equal(Q.PRO_META.length, 50, "50 PRO questions");
});

test("source coverage: every source family stays covered", () => {
  assert.deepEqual(Q.PRO_FAMILIES, {
    EMOTION: 7, CONVERSATION: 7, SHAREABILITY: 6, TIMELINESS: 4,
    CRAFT: 7, IDENTITY: 7, FORMAT: 3, "ANTI-SIGNAL": 9,
  });
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

test("PRO score answers use the PRO rubric length", () => {
  const n = A.normalizeAnswers({
    p_anti_ai_slop: { score: 3 },
    p_emotion_indignation: { score: 1 },
    p_share_reference: { score: "2" },
  }, Q.proApi());
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

test("PRO choice answers parse like MEME ones", () => {
  const n = A.normalizeAnswers({
    p_emotion_dominant: { choice: "amusement", probabilities: { amusement: 0.8, greed: 0.1 } },
  }, Q.proApi());
  const t = n.choices.p_emotion_dominant;
  assert.equal(t.choice, "amusement");
  assert.equal(t.probabilities.amusement, 0.8);
  assert.equal(t.probabilities.greed, 0.1);
});

test("missing or malformed bulk answers never throw", () => {
  for (const bad of [null, undefined, "x", 42, [], {}]) {
    for (const set of [Q.toApi(), Q.proApi()]) {
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
const proIdx = (id) => A.PRO_TILES.findIndex((t) => t.id === id);

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

test("six PRO family tiles: exact order, distinct labels and emoji", () => {
  assert.deepEqual(A.PRO_TILES.map((t) => t.id),
    ["emotion", "conversation", "share", "timely", "craft", "identity"]);
  assert.deepEqual(A.PRO_TILES.map((t) => t.family), [
    "EMOTION", "CONVERSATION", "SHAREABILITY", "TIMELINESS", "CRAFT", "IDENTITY",
  ]);
  const meme = A.tileMeta("meme");
  const pro = A.tileMeta("pro");
  assert.deepEqual(pro.map((t) => t.label), [
    "EMOTION", "CONVERSATION", "SHARE",
    "TIMELY", "CRAFT", "IDENTITY",
  ]);
  const memeLabels = new Set(meme.map((t) => t.label));
  for (const t of pro) {
    assert.ok(!memeLabels.has(t.label), `PRO label ${t.label} reuses a MEME tag name`);
    assert.equal(t.label, t.label.toUpperCase(), `${t.id} uppercase`);
    assert.ok(/[^\x00-\x7f]/.test(t.emoji), `${t.id} has an emoji`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(t.color), `${t.id} color`);
  }
  assert.equal(pro.length, 6, "PRO keeps exactly six tiles");
  // every PRO emoji differs from every MEME emoji on the same tile set
  const memeEmoji = new Set(meme.map((t) => t.emoji));
  for (const t of pro) {
    assert.ok(!memeEmoji.has(t.emoji), `${t.emoji} is not a MEME emoji`);
  }
});

test("PRO tiles derive from the six displayed source families' value questions", () => {
  const displayed = new Set(["EMOTION", "CONVERSATION", "SHAREABILITY",
    "TIMELINESS", "CRAFT", "IDENTITY"]);
  // expected: every non-choice question of a displayed family
  const expected = Q.PRO_META
    .filter((m) => displayed.has(m.family))
    .map((m) => m.id)
    .filter((id) => Q.PRO_QUESTIONS[id].type !== "choice");
  const used = A.PRO_TILES.flatMap((t) => t.signals.map((s) => s.id));
  assert.deepEqual([...used].sort(), [...expected].sort(),
    "PRO tiles cover exactly the displayed families' value questions");
  assert.equal(new Set(used).size, used.length, "no PRO question used by two tiles");
  for (const t of A.PRO_TILES) {
    const famIds = Q.PRO_META.filter((m) => m.family === t.family).map((m) => m.id);
    for (const s of t.signals) {
      assert.ok(famIds.includes(s.id), `${t.id}.${s.id} belongs to the ${t.family} family`);
      assert.notEqual(Q.PRO_QUESTIONS[s.id].type, "choice",
        `${t.id}.${s.id} is a value question, never a choice`);
    }
  }
  // FORMAT and ANTI-SIGNAL stay in the payload but never feed a tile
  const hidden = Q.PRO_META
    .filter((m) => !displayed.has(m.family))
    .map((m) => m.id);
  for (const id of hidden) {
    assert.ok(!used.includes(id), `${id} (${Q.PRO_META.find((m) => m.id === id).family}) not displayed`);
    assert.ok(Q.PRO_QUESTIONS[id], `${id} still ships in the request`);
  }
});

test("empty answers give all-null tiles in both modes", () => {
  for (const [set, fn] of [
    [Q.toApi(), A.tagTiles],
    [Q.proApi(), A.tagTilesPro],
  ]) {
    const tiles = fn(A.normalizeAnswers({}, set));
    assert.equal(tiles.length, 6);
    for (const t of tiles) assert.equal(t.value, null, `${t.id}`);
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

test("IDENTITY hand-computed equal-weight mean (PRO)", () => {
  // (1 + 1 + 0 + 1) / 4 = 0.75 over the four IDENTITY value questions
  const i = proIdx("identity");
  const tiles = A.tagTilesPro(A.normalizeAnswers({
    p_identity_own_experience: { noul: 1 },
    p_identity_advice: { noul: 1 },
    p_identity_ingroup: { noul: 0 },
    p_identity_outgroup: { noul: 1 },
  }, Q.proApi()));
  assert.ok(Math.abs(tiles[i].value - 0.75) < 1e-9, `identity ${tiles[i].value}`);
});

test("choice answers never feed a PRO family tile", () => {
  // a decisive pick on p_emotion_dominant moves nothing on its own
  const tiles = A.tagTilesPro(A.normalizeAnswers({
    p_emotion_dominant: { choice: "amusement", probabilities: { amusement: 1 } },
  }, Q.proApi()));
  assert.equal(tiles[proIdx("emotion")].value, null, "EMOTION stays null");
  for (const t of tiles) assert.equal(t.value, null, `${t.id} null`);
});

test("pure shareability gives SHARE the full share (PRO)", () => {
  const i = proIdx("share");
  const tiles = A.tilesFor("pro", A.normalizeAnswers({
    p_share_send_on: { score: 3 },
  }, Q.proApi()));
  assert.equal(tiles[i].emoji, "📤", "PRO emoji on the tile");
  assert.equal(A.distribution(tiles).points[i], 100, "share takes all points");
});

test("tilesFor dispatches by mode", () => {
  const meme = A.tilesFor("meme", A.normalizeAnswers({ is_pump: { noul: 1 } }, Q.toApi()));
  assert.equal(meme[tileIdx("pump")].value, 1);
  assert.equal(meme[tileIdx("pump")].emoji, "🚀");
  const pro = A.tilesFor("pro", A.normalizeAnswers({ p_craft_first_line: { score: 2 } }, Q.proApi()));
  assert.equal(pro[proIdx("craft")].value, 2 / 3, "first-line rubric reads as CRAFT in PRO");
  assert.equal(pro[proIdx("craft")].emoji, "✍️");
});

test("partial answers never produce NaN", () => {
  for (const [set, fn] of [
    [Q.toApi(), A.tagTiles],
    [Q.proApi(), A.tagTilesPro],
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

test("distribution: PRO family tiles also sum to exactly 100", () => {
  const dist = A.distribution(A.tagTilesPro(A.normalizeAnswers({
    p_emotion_gushing: { noul: 0.5 },
    p_share_quotable: { noul: 0.5 },
    p_craft_economy: { noul: 0.25 },
  }, Q.proApi())));
  assert.ok(dist, "distribution exists");
  assert.equal(dist.total, 100);
  assert.equal(dist.points.reduce((a, b) => a + b, 0), 100, "PRO points sum to 100");
  assert.equal(dist.points.length, 6, "six PRO tiles");
  assert.equal(dist.points[proIdx("emotion")], 40);
  assert.equal(dist.points[proIdx("share")], 40);
  assert.equal(dist.points[proIdx("craft")], 20);
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
  assert.ok(composerSrc.includes('"xjc-opt xjc-opt-"') && composerSrc.includes('opt("pro", "🚀 PRO")')
    && composerSrc.includes('opt("meme", "🤮 MEME"'),
    "internal rocket-PRO / puking-face-MEME labels");
  assert.ok(composerSrc.indexOf('opt("pro"') < composerSrc.indexOf('opt("meme"'),
    "PRO label built before MEME (left side)");
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
  assert.ok(composerSrc.includes('s.analysisMode === "pro" ? "pro" : "meme"'),
    "absent or unknown mode keeps MEME (default for existing users)");
  assert.ok(composerSrc.includes("msg.questions = Q.proApi()"),
    "PRO requests carry the 50-question set");
  assert.ok(composerSrc.includes("makeModeRow"), "switch built with the panel");
});

test("only setStatus, the mode-load spinner and the one-time grid build ever replace slot children", () => {
  const calls = [...composerSrc.matchAll(/\.replaceChildren\(/g)];
  assert.equal(calls.length, 3, "exactly three replaceChildren call sites");
  const statusSrc = composerSrc.slice(
    composerSrc.indexOf("function setStatus"),
    composerSrc.indexOf("function spinnerNode"));
  const loadSrc = composerSrc.slice(
    composerSrc.indexOf("function spinnerNode"),
    composerSrc.indexOf("function ensureGrid"));
  const buildSrc = composerSrc.slice(
    composerSrc.indexOf("function ensureGrid"),
    composerSrc.indexOf("function renderResult"));
  const renderSrc = composerSrc.slice(
    composerSrc.indexOf("function renderResult"),
    composerSrc.indexOf("async function analyze"));
  assert.ok(/replaceChildren\(/.test(statusSrc), "status swaps slot content");
  assert.ok(/replaceChildren\(spinnerNode\(\)\)/.test(loadSrc),
    "a mode change swaps the bars for the spinner");
  assert.ok(/replaceChildren\(grid\)/.test(buildSrc), "grid build inserts once");
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
  assert.ok(cssSrc.includes('.xjc-switch[aria-checked="true"] .xjc-opt-pro'),
    "PRO side blue when checked");
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

test("manifest keeps the composer modules at 0.0.2", () => {
  const m = JSON.parse(read("manifest.json"));
  assert.equal(m.version, "0.0.2");
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
  // rocket PRO left, puking-face MEME right, unchecked (MEME) by default
  assert.equal(modeRow.children.length, 1, "exactly one control in the mode row");
  const sw = modeRow.children[0];
  assert.equal(sw.tagName, "BUTTON", "the control is one button");
  assert.equal(sw.className, "xjc-switch");
  assert.equal(sw.getAttribute("role"), "switch");
  assert.equal(sw.getAttribute("aria-checked"), "false");
  assert.deepEqual(sw.children.map((o) => o.textContent), ["🚀 PRO", "🤮 MEME"]);
  assert.equal(sw.children[0].className, "xjc-opt xjc-opt-pro", "rocket PRO label left");
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
  assert.ok(panel.querySelector(".xjc-status"), "panel still shows its earlier state");

  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 2, "the latest text was re-analyzed");
  xhc.inbox[1].resolve({ answers: { type: { choice: "shitpost", probabilities: { shitpost: 1 } } } });
  await sleep(5);
  const grid = panel.querySelector(".xjc-grid");
  assert.ok(grid, "the current reply rendered");
  assert.equal(grid.children[tileIdx("shitpost")].getAttribute("aria-valuenow"), "100",
    "the latest response wins");
});

test("live panel: switching to PRO saves the mode, spins, then rebuilds bars from zero", async () => {
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
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["pro"],
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
  assert.equal(msg.mode, "pro");
  assert.equal(msg.type, "composerAnalyze");
  assert.equal(Object.keys(msg.questions).length, 50, "the request carries exactly 50 PRO questions");
  assert.deepEqual(msg.questions, Q.proApi(), "the PRO payload is the merged set");
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
  ], "PRO family labels on the fresh bars");
  // zero-to-result animation: every fill begins at zero...
  const fills = grid.children.map((t) => t.children[0].children[0]);
  assert.deepEqual(fills.map((f) => f.style.width), ["0%", "0%", "0%", "0%", "0%", "0%"],
    "all fills begin at zero");
  assert.equal(grid.children[proIdx("share")].getAttribute("aria-valuenow"), "0",
    "meter reads zero before the move");
  flushFrames(1); // frame one paints the zeros
  assert.equal(fills[proIdx("share")].style.width, "0%", "still zero on the zero-paint frame");
  flushFrames(1); // frame two moves to the results
  assert.equal(grid.children[proIdx("share")].getAttribute("aria-valuenow"), "100", "share full");
  assert.equal(fills[proIdx("share")].style.width, "100%", "share fill animated to its result");
  assert.equal(grid.children[proIdx("share")].getAttribute("aria-valuetext"), "100 of 100 points");
  assert.equal(fills[proIdx("conversation")].style.width, "0%", "conversation stayed zero");
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
  assert.ok(panel.querySelector(".xjc-load"), "the spinner waits for the PRO reply");
  assert.equal(xhc.sets.length, 1, "mode still saved");

  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 2, "the draft was re-read in PRO mode");
  assert.equal(xhc.inbox[1].msg.mode, "pro");
  xhc.inbox[1].resolve({ answers: { p_time_news_anchor: { noul: 1 } } });
  await sleep(5);
  flushFrames(); // run the zero-to-result animation to its end
  const grid = panel.querySelector(".xjc-grid");
  assert.ok(grid, "the PRO reply rendered");
  assert.equal(grid.children[proIdx("timely")].getAttribute("aria-valuenow"), "100",
    "the TIMELY family tile carries the reading");
});

test("live panel: stored analysisMode 'pro' boots in PRO mode", async () => {
  const { doc, chrome: xhc } = boot(makeChrome({ enabled: true, sentimentEnabled: true, analysisMode: "pro" }));
  const { editor } = xcomposer(doc);
  await sleep(5);
  typeDraft(doc, editor, "wen moon");
  await sleep(FAST_MS + 20);
  assert.equal(xhc.inbox.length, 1);
  const msg = xhc.inbox[0].msg;
  assert.equal(msg.mode, "pro");
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
  assert.equal(grid.children[proIdx("identity")].getAttribute("aria-valuenow"), "100");
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

  sw.dispatchEvent("click"); // -> PRO
  assert.ok(panel.querySelector(".xjc-load"), "spinner in on the flip");
  assert.ok(!panel.querySelector(".xjc-grid"), "bars gone on the flip");
  await sleep(FAST_MS + 20);
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["pro"]);
  assert.equal(sw.getAttribute("aria-checked"), "true");
  assert.equal(xhc.inbox.length, 2);
  assert.equal(xhc.inbox[1].msg.mode, "pro");
  xhc.inbox[1].resolve({ answers: { p_craft_credential: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  const proGrid = panel.querySelector(".xjc-grid");
  assert.notEqual(proGrid, firstGrid, "PRO built a fresh grid from zero");
  assert.equal(proGrid.children[proIdx("craft")].getAttribute("aria-valuenow"), "100");

  sw.dispatchEvent("click"); // -> MEME again
  assert.ok(panel.querySelector(".xjc-load"), "spinner in on the flip back");
  assert.ok(!panel.querySelector(".xjc-grid"), "PRO bars gone on the flip back");
  await sleep(FAST_MS + 20);
  assert.deepEqual(xhc.sets.map((s) => s.analysisMode), ["pro", "meme"]);
  assert.equal(sw.getAttribute("aria-checked"), "false");
  assert.equal(xhc.inbox.length, 3);
  assert.equal(xhc.inbox[2].msg.mode, "meme");
  assert.ok(!("questions" in xhc.inbox[2].msg), "meme carries no question payload");
  xhc.inbox[2].resolve({ answers: { is_pump: { noul: 1 } } });
  await sleep(5);
  flushFrames();
  const memeGrid = panel.querySelector(".xjc-grid");
  assert.notEqual(memeGrid, proGrid, "grid rebuilt again on the flip back");
  assert.deepEqual(memeGrid.children.map((t) => t.querySelector(".xjc-tile-name").textContent), [
    "💩 SHITPOST", "🎣 BAIT", "😬 CRINGE",
    "🤑 SHILLING", "🚀 PUMP", "😡 RAGE",
  ], "labels flipped back to the MEME tags");
  assert.equal(memeGrid.children[tileIdx("pump")].getAttribute("aria-valuenow"), "100");
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
