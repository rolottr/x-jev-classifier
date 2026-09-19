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
same editor for home posts and replies.

The panel has a MEME/PRO switch:

- **MEME** uses the 15-question feed classifier.
- **PRO** uses 50 merged questions and displays EMOTION, CONVERSATION,
  SHARE, TIMELY, CRAFT and IDENTITY.

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
