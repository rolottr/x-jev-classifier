# X Jev Classifier

A Chrome extension that stamps every X (Twitter) post with what it is:
`🧠 Alpha`, `💩 Shitpost`, `🤖 AI slop`, `🚀 Pump`, `💰 Money flex`, `🎣 Bait`,
`🐍 Scam` … plus a verdict pill: ☣️ HAZMAT, 👀 sus, ✅ clean.

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

## Privacy

- The API key lives only in `chrome.storage.local`
- Post text (and quoted post text) is sent only to `api.typesafe.ai`
- Nothing else is collected, stored or sent anywhere

## Credit and license

This project is a fork of
[imbue-ai/bouncer](https://github.com/imbue-ai/bouncer) and reuses its code.
Bouncer hides posts from your feed; this fork marks them instead — every
label comes from Jev. Licensed under the GNU AGPL v3, the same license as
the original — see [LICENSE](LICENSE).
