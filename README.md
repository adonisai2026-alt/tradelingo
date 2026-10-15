<p align="center"><img src="docs/logo.png" width="96" alt="TradeLingo logo"></p>

<h1 align="center">TradeLingo</h1>
<p align="center"><b>Translator for WhatsApp Web, built for foreign-trade sales.</b><br>
Read every customer message in your own language, write replies in your language, and send them in theirs.</p>

<p align="center">English · <a href="README.zh-CN.md">简体中文</a></p>

> **Disclaimer.** TradeLingo is an independent open-source project. It is **not affiliated with, endorsed by, or sponsored by WhatsApp or Meta**. "WhatsApp" is a trademark of its respective owner and is used here only to describe what the extension works with. TradeLingo is also unrelated to the Chrome Web Store extension "TradeLingo — Learn Construction Spanish While Browsing".

![TradeLingo on WhatsApp Web](docs/screenshots/overview.webp)
<sub>Sample screenshot. Customer names and messages are fictional.</sub>

## Features

- **Incoming messages are translated automatically**, shown under each bubble with a tag for the engine used. Click ⇄ to retranslate one message with another engine.
- **Write in your language, send in theirs.** Click **译** (Translate) or press <kbd>Alt</kbd>+<kbd>T</kbd> to replace your draft with the translation, then press Enter yourself. TradeLingo never sends messages for you.
- **Back-translation check.** After translating, a yellow box shows the translation translated back into your language, so you can confirm prices, quantities and lead times before sending.
- **Per-chat language memory.** Each chat's language is detected with Chrome's built-in language detector (no API quota used) and remembered. Customer messages count most; before a customer replies, your own earlier foreign-language messages are used. You can pin a language per chat.
- **Quick phrases.** Type <kbd>/</kbd> plus a keyword to insert a saved phrase, translated into the current customer's language. The sample phrases use Chinese keywords such as `/交期` (lead time); edit them in the settings page.
- **Glossary.** Force your own terminology (for example `MCCB = moulded case circuit breaker`) for the AI engines.
- **Three engines with automatic fallback.** DeepL, Qwen-MT (Alibaba Cloud Model Studio) and DeepSeek. If one fails (invalid key, quota, outage), TradeLingo switches to the next engine that has a key.
- **Deal battle card (DeepSeek).** Click **单** on the toolbar to turn the current chat into a one-screen battle card: heat with evidence, stage, estimated deal value, blockers, the next step with a one-click draft message, commitments made by both sides, the price history, and missing information with one-click follow-up questions. Every item links to the messages it came from; unknowns stay "unknown". Later updates send only new messages, and AI changes are shown as suggestions you accept or ignore. Fields you edit by hand are locked.
- **Today's follow-up.** All battle cards ranked by estimated value × heat × urgency (overdue promises, customers waiting for your reply, silent customers), computed locally with no API cost. Export to Excel (CSV).
- **Follow-up reminders.** Desktop notifications when your promise or next step is due, or a customer has waited too long for your reply, plus a daily morning digest of who to follow up today. Checked every 15 minutes in the background, even when WhatsApp is closed; unread counts in the WhatsApp chat list are taken into account, so you are reminded even if you never opened the chat. No API cost.
- **Backup and restore.** Export battle cards, phrases, glossary, per-chat languages and settings to a JSON file (API keys optional) and import them on another computer or browser. Imports merge with existing data.
- **WhatsApp change alert.** If WhatsApp Web changes and TradeLingo can no longer find messages or the message box, it tells you instead of silently failing, checks for an update and helps you report it.
- **Setup wizard and update alerts.** A wizard opens after installing and walks you through getting and testing a key. About once a day TradeLingo checks GitHub for a new version and shows a badge on its icon when one is available. Settings show how many characters each engine used this month.
- **More than 30 target languages**, including Bengali, Kazakh, Uzbek, Hindi, Urdu, Persian, Vietnamese, Thai, Malay and Filipino through the AI engines.

The interface is available in **English and Simplified Chinese** (Settings → 界面语言 / Language). Contributions for other UI languages are welcome: add entries to `extension/i18n.js`.

## Engines

| Engine | Default use | Strengths | Get a key |
|---|---|---|---|
| DeepL | Incoming messages | Fast and stable; free plan includes 500,000 characters per month | deepl.com → Account → API Keys |
| Qwen-MT | Outgoing replies | Dedicated translation model, 92 languages, glossary (term intervention), very low cost | Alibaba Cloud Model Studio (Bailian) → API Key |
| DeepSeek | Fallback for translation; **the only engine used for deal battle cards** | Uses recent chat context, adjustable tone | platform.deepseek.com → API Keys |

At least one key is required. Keys are stored only in your browser (`chrome.storage.local`).

## Install

TradeLingo is not on the Chrome Web Store yet. Load it as an unpacked extension:

1. Download this repository (Code → Download ZIP) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the **`extension`** folder.
4. The setup wizard opens automatically: pick an engine, follow the steps to get a key, and click **保存并测试** (Save & test). You can also paste keys later by clicking the TradeLingo icon in the toolbar.
5. Reload WhatsApp Web.

Works the same in **Microsoft Edge**: open `edge://extensions`, turn on Developer mode (left sidebar) and click **Load unpacked**. Settings are not shared between browsers; use Backup and restore to move them.

To update, replace the files in the same folder, click ⟳ on the extension card, and reload WhatsApp Web. Keep loading from the same folder: Chrome ties saved settings to the folder you loaded, so loading from a new folder starts with empty settings.

## Screenshots

| Back-translation check | Quick phrases |
|---|---|
| ![Back-translation](docs/screenshots/back-translation.webp) | ![Quick phrases](docs/screenshots/quick-phrases.webp) |

| Deal battle card | Today's follow-up |
|---|---|
| ![Deal battle card](docs/screenshots/deal-card.webp) | ![Today's follow-up](docs/screenshots/todays-follow-up.webp) |

| Per-chat language memory | AI engines for languages DeepL does not support |
|---|---|
| ![Per-chat language](docs/screenshots/per-chat-language.webp) | ![AI languages](docs/screenshots/ai-languages.webp) |

A full illustrated manual (Simplified Chinese) is in [`docs/manual.zh-CN.html`](docs/manual.zh-CN.html). Download and open it in a browser.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>T</kbd> | Translate the message box |
| <kbd>Alt</kbd>+<kbd>B</kbd> | Back-translate the message box |
| <kbd>/</kbd> + keyword | Open quick phrases |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Copy diagnostic info (contains no message text or phone numbers) |

## Privacy

- Message text is sent only to the translation provider you choose (DeepL, Alibaba Cloud or DeepSeek), directly from your browser. There is no TradeLingo server.
- API keys, glossary, phrases and per-chat languages are stored locally in your browser.
- Per-chat language records store only a hash of the chat ID, never phone numbers.
- Deal battle cards send up to the last 80 visible messages of the open chat to DeepSeek, only when you click; phone numbers are masked first. Cards are stored locally.

See [PRIVACY.md](PRIVACY.md) for details.

## Risks and limitations

- TradeLingo modifies the WhatsApp Web page in your browser. This may not be permitted by WhatsApp's Terms of Service. It only reads and translates text and never sends messages automatically, but **use it at your own risk**.
- WhatsApp Web changes its page structure from time to time. If translations stop appearing, open a chat, press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> and include the copied diagnostic info in an issue.
- Machine translation can be wrong. Always check important terms before sending.

## Project structure

```
extension/        Chrome extension (Manifest V3) — load this folder
  manifest.json
  background.js   Calls DeepL / Qwen-MT / DeepSeek, cache, fallback
  content.js      Runs on WhatsApp Web: translations, toolbar, back-translation, phrases, per-chat language
  deal.js         Deal battle card panel (DeepSeek)
  dealcore.js     Shared deal logic: ranking, text and CSV export
  deals.html/js   Today's follow-up page
  content.css
  options.html/js Settings page
  welcome.html/js First-run setup wizard
  common.js       Shared defaults and language list
  i18n.js         Interface language (Chinese / English) and the English dictionary
  icons/
docs/             Screenshots, logo, illustrated manual
```

No build step and no dependencies.

## Contributing

Issues and pull requests are welcome, especially:

- English and other UI translations
- Selector fixes when WhatsApp Web changes
- More translation engines

## License

The extension is released under the [MIT License](LICENSE). The website, logo, screenshots and illustrated manual in `docs/` are not covered by it: all rights reserved, see [docs/LICENSE-website.md](docs/LICENSE-website.md).
