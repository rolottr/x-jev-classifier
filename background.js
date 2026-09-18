// X Jev Classifier background worker — GENERATED FILE, do not edit by hand.
// Source of truth: jev-auto-tuner/config.json (version 14).
// Regenerate with: python3 jev-auto-tuner/export_extension.py
//
// Calls Jev (TypeSafe System One) directly with the tuned question set.
// The verdict comes from the tuned rules below. No server needed.
// The API key lives only in chrome.storage.local, pasted by the user.

// ==== TUNED CONFIG (config.json v14) ====
const QUESTIONS = {
  "type": {
    "type": "choice",
    "instructions": "The archetype of the post. Plainly reporting an event is news; if the telling itself is the joke — absurd scene, punchline, satire — pick shitpost. A personal experience or opinion told straight stays story",
    "criteria": {
      "alpha": "Concrete, actionable information the reader can use",
      "shitpost": "Joke, meme or bit, made to entertain",
      "ai_slop": "Generic AI-generated filler: emoji storms, hashtag piles, hollow hype",
      "shill": "Promotes a product, service or person for gain",
      "pump": "Hypes a coin, token, NFT or ticker to move its price",
      "scam": "Scam or phishing: giveaway, airdrop, wallet connect",
      "money_flex": "Flexes money, revenue, gains or luxury — including thrift flexes: humble-brags tiny costs or great ratios behind a joke",
      "data": "Numbers, benchmark or chart carry the post",
      "bait": "Begs for replies, reposts or follows, or is a lazy poll asked only to farm replies",
      "rage": "Farms anger or culture war",
      "announce": "Announces a launch, release or milestone",
      "news": "Reports news or an outside event",
      "question": "Mainly asks the audience something (a real question with context, not a bare poll)",
      "wholesome": "Kind, human or heartwarming, asking nothing",
      "callout": "Names a target to complain or expose",
      "creative": "Art, video, build or maker work",
      "story": "Personal anecdote or experience",
      "nothing": "Low-content life update with no payload"
    }
  },
  "is_paid_shill": {
    "type": "noul",
    "instructions": "The post promotes something and looks arranged, sponsored or paid"
  },
  "is_scam": {
    "type": "noul",
    "instructions": "The post is a scam or phishing: giveaway, fake airdrop, wallet connect, double-your-money"
  },
  "is_pump": {
    "type": "noul",
    "instructions": "The post hypes a coin, token, NFT or ticker to move its price"
  },
  "is_bait": {
    "type": "noul",
    "instructions": "The post begs for engagement: reply with a word, repost if, follow to win, tag someone"
  },
  "is_slop": {
    "type": "noul",
    "instructions": "The post reads as AI-generated. Prose tells: stock phrases like 'game-changer', 'delve', 'unlock', 'elevate', 'in today's fast-paced world'; forced rule-of-three lists; 'It's not just X, it's Y' frames; uniform sentence rhythm; tidy summary voice; hollow hype with no specifics. Also emoji piles and hashtag storms"
  },
  "is_rage": {
    "type": "noul",
    "instructions": "The post farms anger or culture war: us versus them, owning the other side. Provoking outrage is its main goal. Light snark, a mocking nickname or a jab inside a genuine anecdote, opinion or story is not rage. Sarcastic gossip mocking one person's choices (e.g. shaming a marriage for money) is snark, not rage, unless it pits groups against each other. Calling out a take or correcting a misconception, even with insults ('lo digo por los subnormales del mimimi'), is callout, not rage, when it argues a point instead of pitting groups against each other"
  },
  "is_alpha": {
    "type": "noul",
    "instructions": "The post shares concrete information the reader can act on today"
  },
  "is_flex": {
    "type": "noul",
    "instructions": "The post flexes money, revenue, gains or status — including reverse flexes: bragging about tiny costs or absurdly good ratios with mock panic or fake complaints ('6,000 users cost me $1.04, I'm going broke'). Not the same as genuinely being broke. Test: do the numbers make the author look good — smart, frugal, winning? If the joke is that the money was wasted and the plan failed ('paid for the gym, went once'), the author is the punchline, not a winner — that is not a flex. Also never a flex: shock at how expensive something is — 'a tiny flat costs almost 300k', rent, groceries. Shock at prices is not bragging; the author gains nothing"
  },
  "is_reply_bait_question": {
    "type": "noul",
    "instructions": "The post asks the audience a question mainly to collect replies or start arguments, not because the author needs an answer. If the post asks no question at all, answer NO. Tells: bare poll ('is anyone still using X?'), versus prompt ('Codex or Claude?'), hot-button or generic question any stranger can chime in on ('is it safe to upgrade yet?', 'is it worth paying 16€?') with no personal need for the answer. A rhetorical question inside a joke, story or rant is NOT reply bait — the author is making a point, not collecting answers. Same when the question targets a mocked third party ('does doing X entitle you to Y?') — it scores a point at someone, it is not put to the reader"
  },
  "question_context": {
    "type": "noul",
    "instructions": "The author shares concrete specifics of their own situation behind the question — their own device, plan, constraint, use case or stake that the answer depends on. A question about a general topic ('is it safe to upgrade?', 'is it worth the price?') is NOT context, even in first person: wanting or considering something is not a situation"
  },
  "question_effort": {
    "type": "score",
    "instructions": "How much thought the question itself shows",
    "criteria": [
      "Bare poll or versus prompt, one line",
      "Light context, still mostly a prompt",
      "Specific situation with stakes",
      "Researched: states what was tried and what is missing"
    ]
  },
  "shill_level": {
    "type": "score",
    "instructions": "How much the post pushes the reader toward a product, beyond just informing about it. Announcing your own work or release plainly is low; marketing hype, urgency or calls to action push it up",
    "criteria": [
      "Sells nothing",
      "Own work: the author announces or shares their own release or project, in an informative way",
      "Pushy pitch: marketing language, hype or calls to action to get the product",
      "Pure ad copy"
    ]
  },
  "slop_level": {
    "type": "score",
    "instructions": "How much the post reads machine-written",
    "criteria": [
      "Human voice, specific and uneven",
      "Mostly human, a few stock phrases",
      "Stock AI prose: forced triads, tidy summary voice, hollow hype",
      "Machine slop: wall-to-wall cliches, emoji piles, zero specifics"
    ]
  },
  "worth_it": {
    "type": "noul",
    "instructions": "The post is worth the reader's time"
  }
};
const RULES = [
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "is_scam",
        "op": ">=",
        "value": 0.5
      }
    ]
  },
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "is_pump",
        "op": ">=",
        "value": 0.6
      }
    ]
  },
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "is_bait",
        "op": ">=",
        "value": 0.7
      }
    ]
  },
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "slop_level",
        "op": ">=",
        "value": 0.8
      }
    ]
  },
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "is_slop",
        "op": ">=",
        "value": 0.85
      }
    ]
  },
  {
    "verdict": "hazmat",
    "all": [
      {
        "metric": "is_rage",
        "op": ">=",
        "value": 0.65
      }
    ]
  },
  {
    "verdict": "sus",
    "all": [
      {
        "metric": "is_reply_bait_question",
        "op": ">=",
        "value": 0.55
      },
      {
        "metric": "question_context",
        "op": "<",
        "value": 0.4
      }
    ]
  },
  {
    "verdict": "sus",
    "all": [
      {
        "metric": "pick",
        "op": "==",
        "value": "question"
      },
      {
        "metric": "question_effort",
        "op": "<=",
        "value": 0.2
      },
      {
        "metric": "question_context",
        "op": "<",
        "value": 0.4
      }
    ]
  },
  {
    "verdict": "sus",
    "all": [
      {
        "metric": "is_paid_shill",
        "op": ">=",
        "value": 0.5
      }
    ]
  },
  {
    "verdict": "sus",
    "all": [
      {
        "metric": "shill_level",
        "op": ">=",
        "value": 0.8
      }
    ]
  },
  {
    "verdict": "sus",
    "all": [
      {
        "metric": "is_flex",
        "op": ">=",
        "value": 0.8
      }
    ]
  }
];
const OVERRIDES = [
  {
    "from": "question",
    "to": "bait",
    "all": [
      {
        "metric": "is_reply_bait_question",
        "op": ">=",
        "value": 0.6
      },
      {
        "metric": "question_context",
        "op": "<",
        "value": 0.35
      }
    ]
  },
  {
    "from": "shitpost",
    "to": "money_flex",
    "all": [
      {
        "metric": "is_flex",
        "op": ">=",
        "value": 0.6
      }
    ]
  },
  {
    "from": "rage",
    "to": "story",
    "all": [
      {
        "metric": "is_rage",
        "op": "<",
        "value": 0.45
      }
    ]
  }
];
const DEFAULT_VERDICT = "clean";
const ARCHETYPES = {
  "alpha": [
    "🧠",
    "Alpha"
  ],
  "shitpost": [
    "💩",
    "Shitpost"
  ],
  "ai_slop": [
    "🤖",
    "AI slop"
  ],
  "shill": [
    "🤑",
    "Shill"
  ],
  "pump": [
    "🚀",
    "Pump"
  ],
  "scam": [
    "🐍",
    "Scam"
  ],
  "money_flex": [
    "💰",
    "Money flex"
  ],
  "data": [
    "📊",
    "Data"
  ],
  "bait": [
    "🎣",
    "Bait"
  ],
  "rage": [
    "😡",
    "Rage bait"
  ],
  "announce": [
    "📣",
    "Announce"
  ],
  "news": [
    "📰",
    "News"
  ],
  "question": [
    "💬",
    "Question"
  ],
  "wholesome": [
    "❤️",
    "Wholesome"
  ],
  "callout": [
    "🫵",
    "Callout"
  ],
  "creative": [
    "🎬",
    "Creative"
  ],
  "story": [
    "📝",
    "Story"
  ],
  "nothing": [
    "😐",
    "Nothing"
  ]
};   // id -> [icon, label]
const FLAG_DISPLAY = {
  "is_paid_shill": [
    "🤑",
    "paid shill"
  ],
  "is_scam": [
    "🐍",
    "scam"
  ],
  "is_pump": [
    "🚀",
    "pump"
  ],
  "is_bait": [
    "🎣",
    "bait"
  ],
  "is_slop": [
    "🤖",
    "slop"
  ],
  "is_rage": [
    "😡",
    "rage"
  ],
  "is_alpha": [
    "🧠",
    "alpha"
  ],
  "is_flex": [
    "💰",
    "flex"
  ],
  "is_reply_bait_question": [
    "🎣",
    "reply bait q"
  ],
  "question_context": [
    "🧩",
    "context"
  ],
  "question_effort": [
    "📝",
    "q effort"
  ]
};
// tooltip level rows: question id -> [icon, label, hot]
const LEVEL_ROWS = [
  [
    "shill_level",
    "🤑",
    "sells hardness",
    true
  ],
  [
    "slop_level",
    "🤖",
    "machine tone",
    true
  ],
  [
    "question_effort",
    "🧩",
    "question effort",
    false
  ],
  [
    "worth_it",
    "⏱",
    "worth your time",
    false
  ]
];

// ==== ENGINE (mirrors jev-auto-tuner/jev_client.py) ====
function metricsFromAnswers(a) {
  const m = {};
  for (const [qid, q] of Object.entries(QUESTIONS)) {
    const ans = a[qid];
    if (!ans) continue;
    if (q.type === "noul") {
      m[qid] = ans.noul || 0;
    } else if (q.type === "score") {
      const n = Math.max(2, (q.criteria || []).length);
      m[qid] = Math.max(0, Math.min(1, (ans.score || 0) / (n - 1)));
    }
    // choice questions are not numeric; "type" becomes m.pick below
  }
  m.pick = (a.type || {}).choice || "nothing";
  return m;
}

function condOk(c, m) {
  const got = m[c.metric];
  if (got === undefined) return false;
  switch (c.op) {
    case ">=": return got >= c.value;
    case ">":  return got > c.value;
    case "<=": return got <= c.value;
    case "<":  return got < c.value;
    case "==": return got === c.value;
    case "!=": return got !== c.value;
    default:   return false;
  }
}

function verdictFromRules(m) {
  for (const r of RULES) {
    if (r.all.length && r.all.every((c) => condOk(c, m))) return r.verdict;
  }
  return DEFAULT_VERDICT;
}

function applyOverrides(pick, m) {
  for (const ov of OVERRIDES) {
    if (pick !== ov.from) continue;
    if (ov.all.length && ov.all.every((c) => condOk(c, m))) return ov.to;
  }
  return pick;
}

function evaluate(a) {
  const m = metricsFromAnswers(a);
  const pick = m.pick;
  const verdict = verdictFromRules(m);
  const finalPick = applyOverrides(pick, m);
  const probs = (a.type || {}).probabilities || {};
  const flags = {};
  for (const [k, v] of Object.entries(m)) {
    if (k !== "pick") flags[k] = Math.round(v * 10000) / 10000;
  }
  return { pick, verdict, finalPick, probs, flags, metrics: m };
}

function buildResult(ev) {
  const types = Object.entries(ev.probs)
    .sort((x, y) => y[1] - x[1]).slice(0, 3)
    .map(([k, v]) => ({
      icon: (ARCHETYPES[k] || ["❓", k])[0],
      label: (ARCHETYPES[k] || ["❓", k])[1],
      frac: Math.round(v * 100),
    }));
  const signals = Object.entries(ev.flags)
    .sort((x, y) => y[1] - x[1])
    .filter(([f, v]) => FLAG_DISPLAY[f] && v >= 0.25)
    .map(([f, v]) => ({
      icon: FLAG_DISPLAY[f][0], label: FLAG_DISPLAY[f][1],
      frac: Math.round(v * 100), hot: v >= 0.6,
    }));
  const levels = LEVEL_ROWS
    .filter(([qid]) => ev.metrics[qid] !== undefined)
    .map(([qid, icon, label, hot]) => ({
      icon, label, hot,
      frac: Math.round(ev.metrics[qid] * 100),
    }));
  return {
    icon: (ARCHETYPES[ev.finalPick] || ["❓", ev.finalPick])[0],
    label: (ARCHETYPES[ev.finalPick] || ["❓", ev.finalPick])[1],
    pick: ev.finalPick,
    verdict: ev.verdict,
    tooltip: { types, signals, levels },
  };
}
// ==== ENGINE-PURE-END ====

// ==== SERVICE WORKER PLUMBING ====
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function settings() {
  const s = await chrome.storage.local.get(["apiKey", "model", "enabled"]);
  return {
    apiKey: s.apiKey || "",
    model: s.model || "jev-latest",
    enabled: s.enabled !== false,
  };
}

async function cacheGet(key) {
  const o = await chrome.storage.local.get({ xbcache: {} });
  return o.xbcache[key] || null;
}

async function cacheSet(key, val) {
  const o = await chrome.storage.local.get({ xbcache: {} });
  const cache = o.xbcache;
  cache[key] = val;
  const keys = Object.keys(cache);
  if (keys.length > 400) {
    for (const k of keys.slice(0, keys.length - 400)) delete cache[k];
  }
  await chrome.storage.local.set({ xbcache: cache });
}

function buildState(text, quote) {
  let state = `X post:\n"""\n${text}\n"""`;
  if (quote && quote.trim()) {
    state += `\n\nThe post above quotes this other X post:\n"""\n${quote.trim()}\n"""`;
  }
  return state;
}

async function callJev(text, quote, apiKey, model) {
  const body = {
    state: buildState(text, quote),
    model,
    questions: QUESTIONS,
  };
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const data = await res.json();
  return data.answers || {};
}

// serialize API calls so a fast scroll does not burst the API
let chain = Promise.resolve();

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "classify") return false;
  chain = chain
    .then(async () => {
      const s = await settings();
      if (!s.enabled) return { error: "disabled" };
      if (!s.apiKey) return { error: "no-key" };
      const text = String(msg.text || "");
      const quote = String(msg.quote || "").slice(0, 1200);
      const key = hash(text + "\u0000" + quote);
      const hit = await cacheGet(key);
      if (hit) return { cached: true, result: hit };
      const answers = await callJev(text, quote, s.apiKey, s.model);
      const result = buildResult(evaluate(answers));
      await cacheSet(key, result);
      return { result };
    })
    .catch((e) => ({ error: String(e && e.message ? e.message : e) }))
    .then(reply);
  return true; // async reply
});
