# X Jev Classifier

Chrome extension for classifying X posts with TypeSafe Jev.

Feed labels include Alpha, Shitpost, AI slop, Pump, Bait, Scam, News and
other classifier tags. The extension also analyzes drafts in the composer.

## Install

1. Download the [latest release](https://github.com/rolottr/x-jev-classifier/releases)
   and unzip it.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Open the extension menu and save your [TypeSafe API key](https://www.typesafe.ai/).
6. Reload X.

## Feed posts

The feed analyzer sends the post and quoted-post context to Jev. It applies
the classifier rules in `background.js` and displays a badge above each post.
Results are cached in `chrome.storage.local`.

## Draft composer

The composer panel updates after about 800 ms of inactivity. It uses the
same editor for home posts and replies. An empty draft keeps the whole
panel collapsed; the first successful result expands it.

The panel has a MEME/NORMIE switch:

- **MEME** uses the 15-question feed classifier and shows the six tags as
  a 100-point distribution.
- **NORMIE** uses all 50 merged questions, including 10 choice questions and
  9 anti-signals. Every question maps to at least one label. Each label
  scores 0–100 on its own:
  `score = round(100 × clamp(mean(positives) × (1 − mean(penalties)), 0, 1))`.
  A choice option counts as `P(option) × option weight`. Anti-signal and
  format penalties reduce only their assigned labels. The six
  scores are independent and never share a total, so a strong draft can
  read 70 or 80 on one label while another stays low.

In NORMIE mode, hover or focus a bar to see its evidence list below the
grid: a green dot marks a positive point, a red dot marks a penalty, and a
grey dot marks a point that does not apply to the post.
Hovering or focusing another bar replaces the list; leaving the area
collapses it. Evidence below 0.5 confidence is grey and does not claim that
the point applies. MEME never shows the evidence list.

The selected mode is saved in `chrome.storage.local`. Mode changes show a
spinner, then animate the new six bars from zero. Retyping updates the
existing bars without rebuilding the panel.

The extension menu has separate switches for feed analysis and draft-post
analysis.

## Privacy

- The TypeSafe API key is stored in `chrome.storage.local`.
- Post and draft text is sent only to `api.typesafe.ai` for analysis.
- Draft text is not cached.

## License

This project is a fork of
[imbue-ai/bouncer](https://github.com/imbue-ai/bouncer) and uses the same
GNU AGPL v3 license. See [LICENSE](LICENSE).
