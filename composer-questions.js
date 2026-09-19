// X Jev Classifier — question sets for the composer tag panel.
//
// Two modes share this module:
//   * MEME — the tuned 15-question classifier set (1 choice, 11 noul,
//     3 score): an exact copy of QUESTIONS in background.js, so the
//     draft request asks the same questions as the feed badges.
//     GENERATED from background.js; a Node test pins the two together,
//     so they can never drift.
//   * PRO  — exactly 50 questions merged from the recovered 61-question
//     source set (11 close pairs merged, see PRO_META below). The merge
//     keeps the family coverage of the source: EMOTION, CONVERSATION,
//     SHAREABILITY, TIMELINESS, CRAFT, IDENTITY, FORMAT, ANTI-SIGNAL.
//
// Loaded two ways: as a content script (global XJevComposerQuestions) and
// in the Node test harness.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.XJevComposerQuestions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // ==== MEME SET ====
  // Mirrors the QUESTIONS object in background.js, byte for byte.
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

  const IDS = Object.keys(QUESTIONS);
  const KINDS = {};
  for (const q of Object.values(QUESTIONS)) KINDS[q.type] = (KINDS[q.type] || 0) + 1;

  // ==== PRO SET ====
  // Exactly 50 questions merged from the recovered 61-question source
  // set. Same concepts, same families; 11 close pairs became single
  // combined questions (PRO_META below is the authoritative source map).
  const PRO_QUESTIONS = {
    // -- EMOTION (7 of 9: humour+twist and self-deprecating+vulnerability merged) --
    "p_emotion_dominant": {
      "type": "choice",
      "instructions": "The strongest feeling the post produces in the reader",
      "criteria": {
        "amusement": "Laughter or a smile",
        "warmth": "Sympathy, kindness or being moved",
        "anger": "Outrage or indignation",
        "sadness": "Disappointment or pity",
        "curiosity": "Wanting to know more",
        "greed": "Fear of missing out, or wanting the same gain",
        "embarrassment": "Secondhand embarrassment, cringe",
        "nothing": "No feeling at all"
      }
    },
    "p_emotion_milestone": {
      "type": "noul",
      "instructions": "A win the author just reached, told with feeling"
    },
    "p_emotion_humour_twist": {
      "type": "score",
      "instructions": "How funny it is to its audience, and whether a twist or punchline breaks the reader's expectation",
      "criteria": [
        "Not funny, and nothing unexpected",
        "A mild smile or a small twist",
        "Clearly funny, with a twist that lands",
        "Laugh-out-loud, with a surprise payoff"
      ]
    },
    "p_emotion_self_exposure": {
      "type": "noul",
      "instructions": "Shows the author's own soft spots: admits a failure or a worry, or makes himself the butt of the joke"
    },
    "p_emotion_indignation": {
      "type": "score",
      "instructions": "How annoyed or indignant the post sounds",
      "criteria": [
        "Calm throughout",
        "Mild irritation shows",
        "Clearly annoyed",
        "Furious"
      ]
    },
    "p_emotion_relatable": {
      "type": "score",
      "instructions": "A named experience the readers recognize as their own",
      "criteria": [
        "No shared experience at all",
        "Generic, anyone could claim it",
        "A specific experience many readers share",
        "The reader's exact experience, named precisely"
      ]
    },
    "p_emotion_gushing": {
      "type": "noul",
      "instructions": "Praise for someone with nothing at stake: pure gushing"
    },
    // -- CONVERSATION (7 of 9: asks-own-experience+leaves-opening and help+networking merged) --
    "p_conv_question_kind": {
      "type": "choice",
      "instructions": "What kind of question the post asks, if any",
      "criteria": {
        "none": "Asks no question",
        "bare_poll": "Bare poll or versus prompt, one line",
        "genuine": "A real question with the author's own context",
        "help": "Asks readers what to do"
      }
    },
    "p_conv_easy_answer": {
      "type": "score",
      "instructions": "How easy it is for a reader to reply to it",
      "criteria": [
        "Nothing to say",
        "Hard to answer",
        "An easy one-line reply",
        "Easy and fun to answer"
      ]
    },
    "p_conv_reader_gap": {
      "type": "noul",
      "instructions": "Leaves a gap a reader can fill: an open slot in the post, or an explicit ask for the readers' own experience"
    },
    "p_conv_ask_action": {
      "type": "noul",
      "instructions": "Asks the readers to do something for the author: what to do, or to connect with him"
    },
    "p_conv_contestable": {
      "type": "score",
      "instructions": "A claim some readers would argue with",
      "criteria": [
        "Nothing arguable",
        "A small quibble is possible",
        "Clear sides are possible",
        "A guaranteed argument"
      ]
    },
    "p_conv_group_challenge": {
      "type": "noul",
      "instructions": "Puts a named group on the spot"
    },
    "p_conv_reply_forecast": {
      "type": "choice",
      "instructions": "The replies the post will get",
      "criteria": {
        "jokes": "Jokes and bits",
        "agreement": "Agreement and praise",
        "arguments": "Arguments and dunking",
        "answers": "Helpful answers",
        "silence": "Few or no replies"
      }
    },
    // -- SHAREABILITY (6 of 7: group-chat+send-to-one-person merged) --
    "p_share_send_on": {
      "type": "score",
      "instructions": "How much someone would send it on: to one person or a group chat",
      "criteria": [
        "Nobody sends it on",
        "One person might get it",
        "A few people would share it",
        "Made to be spread in group chats"
      ]
    },
    "p_share_stands_alone": {
      "type": "score",
      "instructions": "It makes sense on its own, without outside context",
      "criteria": [
        "Needs missing context",
        "Has gaps",
        "Almost standalone",
        "Fully standalone"
      ]
    },
    "p_share_reference": {
      "type": "score",
      "instructions": "Worth saving and coming back to later",
      "criteria": [
        "Not worth saving",
        "Might be useful once",
        "Worth bookmarking",
        "Reference material"
      ]
    },
    "p_share_quotable": {
      "type": "noul",
      "instructions": "One line can be lifted out and quoted on its own"
    },
    "p_share_useful_favour": {
      "type": "noul",
      "instructions": "A concrete use for a specific kind of reader"
    },
    "p_share_names_accounts": {
      "type": "noul",
      "instructions": "Built around naming several people or accounts"
    },
    // -- TIMELINESS (4 of 5: current-event+newsworthy-entity merged) --
    "p_time_news_anchor": {
      "type": "noul",
      "instructions": "Hangs on a recent outside event, or names a company or person as news"
    },
    "p_time_angle": {
      "type": "choice",
      "instructions": "Its angle on the news or event it hangs on",
      "criteria": {
        "report": "Reports it plainly",
        "new_info": "Adds new information of its own",
        "take": "Opinion or hot take on it",
        "joke": "Joke or meme about it"
      }
    },
    "p_time_position": {
      "type": "choice",
      "instructions": "Where the post sits in time relative to the event or trend",
      "criteria": {
        "early": "Ahead of everyone else",
        "ontime": "On time, part of the moment",
        "late": "Late, after the moment passed",
        "timeless": "Not tied to any moment"
      }
    },
    "p_time_meme_format": {
      "type": "noul",
      "instructions": "Built on a known template, format or meme"
    },
    // -- CRAFT (7 of 9: specificity+concrete-numbers and one-point+wordiness merged) --
    "p_craft_specific": {
      "type": "score",
      "instructions": "How concrete the detail is, including numbers that carry weight",
      "criteria": [
        "Vague throughout",
        "Some specifics",
        "Concrete details throughout",
        "Sharp specifics and weighty numbers"
      ]
    },
    "p_craft_first_line": {
      "type": "score",
      "instructions": "How much the first line pulls the reader in",
      "criteria": [
        "No pull at all",
        "A slight pull",
        "A strong hook",
        "Impossible to stop reading"
      ]
    },
    "p_craft_payoff_inside": {
      "type": "noul",
      "instructions": "The whole payoff is inside the post, not behind a link"
    },
    "p_craft_credential": {
      "type": "noul",
      "instructions": "A result of the author's own backs the point"
    },
    "p_craft_economy": {
      "type": "noul",
      "instructions": "One clear point or one clear story, told with no filler padding"
    },
    "p_craft_voice": {
      "type": "choice",
      "instructions": "How the voice reads",
      "criteria": {
        "plain": "Plain, direct talk",
        "insider": "Insider slang and in-jokes",
        "hype": "Hype-man energy, everything is huge",
        "formal": "Formal, essay-like"
      }
    },
    "p_craft_micro_anecdote": {
      "type": "noul",
      "instructions": "A short incident with a line that lands"
    },
    // -- IDENTITY (7 of 9: role+self-intro and peer+ingroup merged) --
    "p_identity_own_experience": {
      "type": "noul",
      "instructions": "The author's own experience is the subject"
    },
    "p_identity_role": {
      "type": "choice",
      "instructions": "Who the author is speaking as",
      "criteria": {
        "peer": "A peer sharing his own experience",
        "expert": "An expert teaching or explaining",
        "seller": "A seller pitching something",
        "fan": "A fan praising someone",
        "critic": "A critic attacking someone",
        "intro": "Someone introducing himself",
        "reporter": "A neutral reporter"
      }
    },
    "p_identity_advice": {
      "type": "noul",
      "instructions": "Tells the reader what to do"
    },
    "p_identity_ingroup": {
      "type": "noul",
      "instructions": "Speaks to a named group as one of them, or praises that group's identity"
    },
    "p_identity_outgroup": {
      "type": "noul",
      "instructions": "Criticises a group or a named target"
    },
    "p_identity_audience": {
      "type": "choice",
      "instructions": "How wide the intended audience is",
      "criteria": {
        "one": "One person",
        "niche": "A niche group",
        "community": "A wide community",
        "everyone": "Everyone on the app"
      }
    },
    "p_identity_sell": {
      "type": "choice",
      "instructions": "How much the post sells",
      "criteria": {
        "nothing": "Sells nothing",
        "own_work": "Announces the author's own work, plainly and informatively",
        "pitch": "A pitch with marketing language or calls to action",
        "arranged": "Promotion of someone else that looks arranged, sponsored or paid"
      }
    },
    // -- FORMAT (3 of 3) --
    "p_format_post_type": {
      "type": "choice",
      "instructions": "What kind of post it is, in form",
      "criteria": {
        "joke": "Joke, meme or bit",
        "story": "Personal story or anecdote",
        "take": "Opinion or take",
        "question": "A question to the audience",
        "news": "News report of an outside event",
        "announce": "Announcement or launch",
        "promo": "Promotion of a product, service or person",
        "creative": "Art, video, build or maker work"
      }
    },
    "p_format_quote_dependence": {
      "type": "noul",
      "instructions": "The words lean on the attached image or the quoted post to make sense"
    },
    "p_format_reused_template": {
      "type": "noul",
      "instructions": "A structure readers have seen many times elsewhere"
    },
    // -- ANTI-SIGNAL (9 of 10: platitude+low-effort merged) --
    "p_anti_reply_farm": {
      "type": "score",
      "instructions": "Asking for replies, reposts or follows is the point of the post",
      "criteria": [
        "No ask at all",
        "A light nudge",
        "An explicit ask for engagement",
        "Pure engagement farming"
      ]
    },
    "p_anti_ai_slop": {
      "type": "score",
      "instructions": "Reads as machine written",
      "criteria": [
        "Human voice, specific and uneven",
        "Mostly human, a few stock phrases",
        "Stock AI prose and tidy summary voice",
        "Machine slop wall to wall"
      ]
    },
    "p_anti_empty_words": {
      "type": "noul",
      "instructions": "An empty payload: a recycled maxim with nothing new, or nothing specific to react to"
    },
    "p_anti_hype_caption": {
      "type": "noul",
      "instructions": "Excitement words with no substance behind them"
    },
    "p_anti_incentivised": {
      "type": "noul",
      "instructions": "Promotion of someone else that looks arranged, incentivised or paid"
    },
    "p_anti_bare_announcement": {
      "type": "noul",
      "instructions": "Newswire tone with nobody speaking: a bare announcement"
    },
    "p_anti_off_platform": {
      "type": "noul",
      "instructions": "Pushes readers off the platform: a link, a newsletter, a telegram"
    },
    "p_anti_offensive": {
      "type": "noul",
      "instructions": "Abuse or harassment"
    },
    "p_anti_politics": {
      "type": "noul",
      "instructions": "Politics or culture war content"
    }
  };

  // ==== PRO SOURCE COVERAGE ====
  // The recovered source set had 61 ids (PRO_SOURCE_IDS pins them all).
  // Every PRO question lists the source ids it covers in PRO_META. The
  // 11 entries with two sources are the merges — 61 sources flow into
  // 50 questions, with no source id dropped or doubled:
  //   e_humour                + e_surprise_twist          -> p_emotion_humour_twist
  //   e_self_deprecating      + e_vulnerability           -> p_emotion_self_exposure
  //   c_asks_own_experience   + c_leaves_opening          -> p_conv_reader_gap
  //   c_help_request          + c_networking_invitation   -> p_conv_ask_action
  //   s_group_chat            + s_send_to_one_person      -> p_share_send_on
  //   t_current_event         + t_names_newsworthy_entity -> p_time_news_anchor
  //   k_specificity           + k_concrete_numbers        -> p_craft_specific
  //   k_one_point             + k_wordiness               -> p_craft_economy
  //   i_role                  + i_self_intro              -> p_identity_role
  //   i_addresses_group_as_peer + i_ingroup_affirmation   -> p_identity_ingroup
  //   a_platitude             + a_low_effort              -> p_anti_empty_words
  const PRO_SOURCE_IDS = [
    "e_dominant_emotion", "e_milestone_joy", "e_humour", "e_self_deprecating",
    "e_indignation", "e_vulnerability", "e_relatable_experience",
    "e_surprise_twist", "e_gushing_no_tension",
    "c_question_kind", "c_easy_to_answer", "c_asks_own_experience",
    "c_help_request", "c_networking_invitation", "c_contestable_claim",
    "c_identity_challenge", "c_reply_tone_forecast", "c_leaves_opening",
    "s_group_chat", "s_send_to_one_person", "s_stands_alone",
    "s_reference_worthy", "s_quotable_line", "s_useful_favour",
    "s_names_accounts",
    "t_current_event", "t_event_angle", "t_time_position",
    "t_names_newsworthy_entity", "t_meme_format",
    "k_specificity", "k_first_line_hook", "k_payoff_inside",
    "k_concrete_numbers", "k_credential_proof", "k_one_point",
    "k_wordiness", "k_voice_register", "k_micro_anecdote",
    "i_first_person_own", "i_role", "i_second_person_advice",
    "i_addresses_group_as_peer", "i_outgroup_target", "i_ingroup_affirmation",
    "i_self_intro", "i_audience_breadth", "i_self_promotion",
    "f_post_type", "f_quoted_dependence", "f_reused_template",
    "a_reply_farm", "a_ai_slop", "a_platitude", "a_incentivised_promotion",
    "a_bare_announcement", "a_low_effort", "a_hype_caption",
    "a_off_platform_push", "a_offensive", "a_politics_culture_war",
  ];

  const PRO_META = [
    { id: "p_emotion_dominant", family: "EMOTION", sources: ["e_dominant_emotion"] },
    { id: "p_emotion_milestone", family: "EMOTION", sources: ["e_milestone_joy"] },
    { id: "p_emotion_humour_twist", family: "EMOTION", sources: ["e_humour", "e_surprise_twist"] },
    { id: "p_emotion_self_exposure", family: "EMOTION", sources: ["e_self_deprecating", "e_vulnerability"] },
    { id: "p_emotion_indignation", family: "EMOTION", sources: ["e_indignation"] },
    { id: "p_emotion_relatable", family: "EMOTION", sources: ["e_relatable_experience"] },
    { id: "p_emotion_gushing", family: "EMOTION", sources: ["e_gushing_no_tension"] },
    { id: "p_conv_question_kind", family: "CONVERSATION", sources: ["c_question_kind"] },
    { id: "p_conv_easy_answer", family: "CONVERSATION", sources: ["c_easy_to_answer"] },
    { id: "p_conv_reader_gap", family: "CONVERSATION", sources: ["c_asks_own_experience", "c_leaves_opening"] },
    { id: "p_conv_ask_action", family: "CONVERSATION", sources: ["c_help_request", "c_networking_invitation"] },
    { id: "p_conv_contestable", family: "CONVERSATION", sources: ["c_contestable_claim"] },
    { id: "p_conv_group_challenge", family: "CONVERSATION", sources: ["c_identity_challenge"] },
    { id: "p_conv_reply_forecast", family: "CONVERSATION", sources: ["c_reply_tone_forecast"] },
    { id: "p_share_send_on", family: "SHAREABILITY", sources: ["s_group_chat", "s_send_to_one_person"] },
    { id: "p_share_stands_alone", family: "SHAREABILITY", sources: ["s_stands_alone"] },
    { id: "p_share_reference", family: "SHAREABILITY", sources: ["s_reference_worthy"] },
    { id: "p_share_quotable", family: "SHAREABILITY", sources: ["s_quotable_line"] },
    { id: "p_share_useful_favour", family: "SHAREABILITY", sources: ["s_useful_favour"] },
    { id: "p_share_names_accounts", family: "SHAREABILITY", sources: ["s_names_accounts"] },
    { id: "p_time_news_anchor", family: "TIMELINESS", sources: ["t_current_event", "t_names_newsworthy_entity"] },
    { id: "p_time_angle", family: "TIMELINESS", sources: ["t_event_angle"] },
    { id: "p_time_position", family: "TIMELINESS", sources: ["t_time_position"] },
    { id: "p_time_meme_format", family: "TIMELINESS", sources: ["t_meme_format"] },
    { id: "p_craft_specific", family: "CRAFT", sources: ["k_specificity", "k_concrete_numbers"] },
    { id: "p_craft_first_line", family: "CRAFT", sources: ["k_first_line_hook"] },
    { id: "p_craft_payoff_inside", family: "CRAFT", sources: ["k_payoff_inside"] },
    { id: "p_craft_credential", family: "CRAFT", sources: ["k_credential_proof"] },
    { id: "p_craft_economy", family: "CRAFT", sources: ["k_one_point", "k_wordiness"] },
    { id: "p_craft_voice", family: "CRAFT", sources: ["k_voice_register"] },
    { id: "p_craft_micro_anecdote", family: "CRAFT", sources: ["k_micro_anecdote"] },
    { id: "p_identity_own_experience", family: "IDENTITY", sources: ["i_first_person_own"] },
    { id: "p_identity_role", family: "IDENTITY", sources: ["i_role", "i_self_intro"] },
    { id: "p_identity_advice", family: "IDENTITY", sources: ["i_second_person_advice"] },
    { id: "p_identity_ingroup", family: "IDENTITY", sources: ["i_addresses_group_as_peer", "i_ingroup_affirmation"] },
    { id: "p_identity_outgroup", family: "IDENTITY", sources: ["i_outgroup_target"] },
    { id: "p_identity_audience", family: "IDENTITY", sources: ["i_audience_breadth"] },
    { id: "p_identity_sell", family: "IDENTITY", sources: ["i_self_promotion"] },
    { id: "p_format_post_type", family: "FORMAT", sources: ["f_post_type"] },
    { id: "p_format_quote_dependence", family: "FORMAT", sources: ["f_quoted_dependence"] },
    { id: "p_format_reused_template", family: "FORMAT", sources: ["f_reused_template"] },
    { id: "p_anti_reply_farm", family: "ANTI-SIGNAL", sources: ["a_reply_farm"] },
    { id: "p_anti_ai_slop", family: "ANTI-SIGNAL", sources: ["a_ai_slop"] },
    { id: "p_anti_empty_words", family: "ANTI-SIGNAL", sources: ["a_platitude", "a_low_effort"] },
    { id: "p_anti_hype_caption", family: "ANTI-SIGNAL", sources: ["a_hype_caption"] },
    { id: "p_anti_incentivised", family: "ANTI-SIGNAL", sources: ["a_incentivised_promotion"] },
    { id: "p_anti_bare_announcement", family: "ANTI-SIGNAL", sources: ["a_bare_announcement"] },
    { id: "p_anti_off_platform", family: "ANTI-SIGNAL", sources: ["a_off_platform_push"] },
    { id: "p_anti_offensive", family: "ANTI-SIGNAL", sources: ["a_offensive"] },
    { id: "p_anti_politics", family: "ANTI-SIGNAL", sources: ["a_politics_culture_war"] },
  ];

  const PRO_IDS = Object.keys(PRO_QUESTIONS);
  const PRO_KINDS = {};
  for (const q of Object.values(PRO_QUESTIONS)) PRO_KINDS[q.type] = (PRO_KINDS[q.type] || 0) + 1;
  const PRO_FAMILIES = {};
  for (const m of PRO_META) PRO_FAMILIES[m.family] = (PRO_FAMILIES[m.family] || 0) + 1;

  function toApi() {
    return QUESTIONS;
  }

  function proApi() {
    return PRO_QUESTIONS;
  }

  function questionsFor(mode) {
    return mode === "pro" ? PRO_QUESTIONS : QUESTIONS;
  }

  return {
    QUESTIONS, IDS, COUNT: IDS.length, KINDS, toApi,
    PRO_QUESTIONS, PRO_IDS, PRO_COUNT: PRO_IDS.length, PRO_KINDS, proApi,
    PRO_META, PRO_SOURCE_IDS, PRO_FAMILIES, questionsFor,
  };
});
