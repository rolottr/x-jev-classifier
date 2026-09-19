# X Jev Classifier

A Chrome extension that stamps every X (Twitter) post with what it is:
`🧠 Alpha`, `💩 Shitpost`, `🤖 AI slop`, `🚀 Pump`, `💰 Money flex`, `🎣 Bait`,
`🐍 Scam` … plus a verdict pill: ☣️ HAZMAT, 👀 sus, ✅ clean. While you
write, the composer panel scores your draft on six tiles — the MEME tags
(SHITPOST, BAIT, CRINGE, SHILLING, PUMP, RAGE) or, in PRO mode, six
structured dimensions (EMOTION, CONVERSATION, SHARE, TIMELY, CRAFT,
IDENTITY).

Nothing is hidden and nothing is blocked. Posts are only marked. You still
see everything — you just know what you are looking at.

## Install

1. Download the [latest release](https://github.com/rolottr/x-jev-classifier/releases)
   and unzip it (or clone this repo)
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the folder
5. Open x.com, click the puzzle icon, pin **X Jev Classifier**, click its icon
6. Paste your [TypeSafe](https://www.typesafe.ai/) API key and press **Save**
7. Reload the x.com tab

Badges appear above each post. Hover a badge for the full analysis.

## How it marks posts — Jev, not vibes

Every label comes from [Jev](https://www.typesafe.ai/), a decision model by
TypeSafe AI. Jev does not chat and does not write prose. You send it typed
questions and it returns typed answers with calibrated probabilities. That
makes it a judge you can put rules on top of. This extension does exactly
that, in four steps.

### 1. The post becomes a state block

The content script reads the post text — and, when the post quotes another
post, the quoted text too, as context. A reaction to a joke is then judged as
a reaction, not as low-content noise:

```
X post:
"""
can't even express how accurate this is
"""

The post above quotes this other X post:
"""
BREAKING: ADHD researchers confirm that having "one single appointment"
at 3:00 PM successfully destroys the entire day leading up to it.
"""
```

### 2. One API call asks ~15 typed questions

`background.js` sends the state plus the question set to
`https://api.typesafe.ai/v1/systemone` in a single request. Jev supports
three question kinds, and all three are used:

| Kind | Returns | Example question |
|---|---|---|
| `noul` | P(yes), 0..1 | "The post is a scam or phishing: giveaway, fake airdrop, wallet connect" |
| `score` | level 0..3 on a rubric | "How much the post reads machine-written" — Human voice → Mostly human → Stock AI prose → Machine slop |
| `choice` | one pick + probability per option | "The archetype of the post" — alpha, shitpost, ai_slop, pump, bait, … 18 archetypes |

A Jev answer looks like this:

```json
"is_scam":  { "noul": 0.03 },
"slop_level": { "score": 1 },
"type": { "choice": "bait", "probabilities": { "bait": 0.62, "question": 0.21 } }
```

### 3. Plain threshold rules turn answers into a verdict

Scores are normalized to 0..1 and compared against an ordered rule list —
first match wins. The rules are data at the top of `background.js`, not
code:

```js
const RULES = [
  { verdict: "hazmat", all: [{ metric: "is_scam",   op: ">=", value: 0.5 }] },
  { verdict: "hazmat", all: [{ metric: "is_pump",   op: ">=", value: 0.6 }] },
  { verdict: "hazmat", all: [{ metric: "is_bait",   op: ">=", value: 0.7 }] },
  { verdict: "sus",    all: [{ metric: "is_flex",   op: ">=", value: 0.8 }] },
  // …
];
```

A small engine applies them, then archetype overrides handle edge cases a
single threshold cannot express. A lazy poll ("Codex or Claude?") picks
`question`, but it works like bait — so an override relabels it when
reply-bait probability is high and the author shared no context of their own:

```js
const OVERRIDES = [
  { from: "question", to: "bait",
    all: [{ metric: "is_reply_bait_question", op: ">=", value: 0.6 },
          { metric: "question_context",       op: "<",  value: 0.35 }] },
];
```

The wording of the questions and the rule thresholds were tuned against real
posts: every rule and question in the build earned its place by fixing an
observed mislabel without breaking known-good cases.

### 4. The badge renders, the answer caches

The verdict, the archetype and the full metric set render as a badge; hover
it for the top archetype probabilities, fired signals and level bars.
Results are cached by post text + quote text in `chrome.storage.local`, so
re-scrolling a feed costs nothing.

## Draft composer: tag panel

While you write a post, a second panel reads the draft. It never posts,
replies, likes or touches any X control — it only reads the text you typed.
The draft is analyzed by the same [Jev](https://www.typesafe.ai/) model,
through the same `api.typesafe.ai/v1/systemone` endpoint and the same API
key and model settings, but on a separate code path that leaves the feed
classifier untouched.

- The panel attaches inside the composer container, immediately above the
  footer row that holds the toolbar and the Post/Reply button. The X
  composer has no `<form>`; the host is found from the editor and that
  button, and the panel never enters the Draft.js editor subtree, so the
  textbox and its text always stay intact. It shows only while a draft
  exists. No draft, no panel. The panel wears no card chrome: one
  straight 1px top line separates it from the composer.
- Analysis runs ~800 ms after you stop typing. Empty drafts are ignored.
  When you keep typing, each keystroke cancels the pending update, aborts
  the in-flight request and drops stale results, so the panel always
  matches the current text after the next quiet period. In the same mode
  the grid is built once and then only its bars move: retyping never
  rebuilds the tiles, and the grid stays on screen while a new draft is
  being read.
- API errors and an empty state show inline in the panel. Errors never
  block the composer.

The extension menu has separate checkboxes for **Analyze feed posts** and
**Analyze draft posts**, below the API key and model fields. Both are on
by default and apply without a page reload.

### Two modes: MEME and PRO

One segmented switch sits at the top-right, above the six bars: a
single compact control with an outline and two internal labels — 🚀 PRO
on the left, 🤮 MEME on the right — styled after X dark mode (the
selected side blue, the other dark gray). It is one semantic
`role="switch"` button, not two standalone buttons, so keyboard and
screen-reader users get one control with one state. The choice is saved
to `chrome.storage.local` as `analysisMode`. MEME is the default, so
existing users stay on MEME. Switching the mode invalidates the
in-flight request at once, drops the current bars for a small spinner
and re-analyzes the current draft; when the reply lands, fresh bars are
built with every fill at zero and animate up to their result widths.
The switch stays visible throughout.

| Mode | Questions | Tiles | Sent when |
|---|---|---|---|
| MEME | The tuned 15-question classifier set from `background.js`, byte for byte — the same questions the feed badges use | The six classifier tags | default |
| PRO | Exactly 50 merged questions defined in `composer-questions.js` | The six PRO dimensions | after you switch to PRO |

The PRO request carries its own 50-question payload; the MEME request
always sends the classifier set straight from `background.js`.

### The six tiles, one per mode

Both modes show exactly six bare tiles in a 3-column by 2-row grid (no
card chrome): share bar above, emoji plus uppercase name below. NEWS,
SCAM and ALPHA are gone. The bars carry no visible numbers: their
lengths form a normalized distribution that always sums to exactly 100
points (largest-remainder rounding). Each tile keeps an ARIA meter
label, so the readings stay accessible. The mapping lives in
`composer-analysis.js`; tag names stay uppercase in both modes.

MEME tiles (the classifier tags):

| Tile | Built from |
|---|---|
| 💩 SHITPOST | type `shitpost` |
| 🎣 BAIT | type `bait`, type `question`, `is_bait`, `is_reply_bait_question`, low `question_context` |
| 😬 CRINGE | type `ai_slop`, `is_slop`, `slop_level` |
| 🤑 SHILLING | type `shill`, type `money_flex`, `is_paid_shill`, `shill_level` |
| 🚀 PUMP | type `pump`, `is_pump` |
| 😡 RAGE | type `rage`, `is_rage` |

PRO tiles (the six displayed PRO dimensions, in this exact order —
no label reuses a MEME tag name):

| Tile | PRO family | Built from |
|---|---|---|
| 🎭 EMOTION | emotion | milestone joy, humour+twist, self-exposure, indignation, relatability, gushing |
| 💬 CONVERSATION | conversation | easy answer, reader gap, ask action, contestable claim, group challenge |
| 📤 SHARE | shareability | send-on, stands alone, reference, quotable line, useful favour, named accounts |
| ⏰ TIMELY | timeliness | news anchor, meme format |
| ✍️ CRAFT | craft | specificity, first line, payoff inside, credential, economy, micro anecdote |
| 🪪 IDENTITY | identity | own experience, advice, ingroup, outgroup |

Each PRO tile value is the equal-weight mean of its family's answered
value questions (`noul`, `score`). Choice questions inside the families
stay in the payload but never feed a tile — their options are nominal,
not ordered. FORMAT and ANTI-SIGNAL answers are requested for coverage
only and are never displayed as tiles.

Answers are normalized to 0..1, clamped, and missing or malformed answers
drop out safely. A draft with no answer data keeps the empty state.

PRO uses exactly 50 merged questions defined in `composer-questions.js`.
Answers are normalized to 0..1, clamped, and missing or malformed answers
drop out safely. A draft with no answer data keeps the empty state.

## Checks

```
for script in background.js content.js composer-questions.js composer-analysis.js composer.js; do
  node --check "$script" || exit 1
done
node tests/composer.test.js
```

## Privacy

- The API key lives only in `chrome.storage.local`
- Post text (and quoted post text) is sent only to `api.typesafe.ai`
- Draft text is sent only to `api.typesafe.ai`, only after you pause
  typing, and is never cached or stored anywhere
- Nothing else is collected, stored or sent anywhere

## Credit and license

This project is a fork of
[imbue-ai/bouncer](https://github.com/imbue-ai/bouncer) and reuses its code.
Bouncer hides posts from your feed; this fork marks them instead — every
label comes from Jev. Licensed under the GNU AGPL v3, the same license as
the original — see [LICENSE](LICENSE).
