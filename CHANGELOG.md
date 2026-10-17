# Changelog / 更新记录

## 0.10.2
- Fixed: editing a list section of the deal card (promises, price history, blockers, needs, missing info) turned the whole section into locked free text, so later updates never added new items, and edited promises lost their due dates (no reminders, empty "Promise due" in Notion). Edits are now saved item by item; items you change are marked ✎ and kept verbatim on update, while new items from the chat are still suggested. The merge is enforced in code, so your edits survive even if the AI rewrites or drops them.
- Editing "Next step" keeps owner and due date, so reminders and Notion dates keep working; an edited next step can be written to the customer in one click.
- Due dates are recognised in more formats (2026-10-20, 10-20, 10/20, 10月20日, Oct 20); vague ones like "next Friday" show a hint instead of being guessed. Free-text heat shows a hint to use High / Medium / Low.
- Notion: a hand-written stage is only mapped to a standard stage when it matches exactly; otherwise it is written as is.
- Existing cards edited with older versions are converted automatically on update.
- 修复：手动修改作战卡的承诺、报价、卡点、需求、缺失信息后，整项被锁成一段文字，之后“更新”不再加入新内容，改过的承诺也失去截止日期（不提醒、Notion 无日期）。现在按条保存：你改过的条目标 ✎，更新时原样保留（由代码保证，不依赖 AI），新内容照常以建议形式加入。修改“下一步”保留负责方和截止日期。截止日期支持更多写法，认不出时提示；热度写法不对时提示。Notion 阶段不再模糊归类。旧数据升级时自动转换。

## 0.10.1
- Fixed: the quick-phrase menu opened with the 话 (Phrases) button closed immediately (always when the message box was empty, and also when it had text). It now stays open until you pick a phrase, press Esc, click elsewhere or click the button again. Picking a phrase from the button keeps what you've already typed and adds the translated phrase after it.
- Fixed: when sending an image, text in the "Add a caption" box couldn't be translated, because the extension used the chat message box hidden behind the image editor. It now prefers the box you're typing in and ignores covered ones; the toolbar, back-translation and phrases follow the caption box.
- New: quick-phrase trigger key setting, "/" (default) or ";". WhatsApp Business opens its own quick replies with "/", which clashed with the extension (both lists appeared and Enter was taken by the extension). Business users can choose ";" (the full-width "；" from Chinese input methods works too); the setup wizard asks whether you use WhatsApp Business.
- Phrase search lists keyword matches before matches in the phrase text.
- 修复：点“话”打开的话术框会立刻消失（输入框为空时必现，有文字时也会），现在会一直显示，直到选择、按 Esc、点别处或再点一次“话”；从“话”插入时保留已写的文字。
- 修复：发图片时“添加说明”里的文字不能翻译（插件误用了被图片界面挡住的聊天输入框）。现在优先使用正在输入、没有被挡住的输入框。
- 新增：快捷话术触发键可选“/”（默认）或“;”，避免和 WhatsApp Business 自带的“/”快捷回复冲突；中文输入法的“；”也可以。向导里会询问是否使用 WhatsApp Business。话术筛选时关键词匹配的排在前面。

## 0.10.0
- New: **Notion sync** (one way, TradeLingo → Notion). Paste a Notion internal-connection token, pick a page shared with the connection, and TradeLingo creates a "TradeLingo deals" database (23 columns: customer, heat, stage, estimated value, next step and due date, our promises and the earliest due date, reply status, last messages, priority, needs, terms, blockers, price history, missing info, summary…). Deal cards are written a few seconds after they change; unchanged cards aren't re-sent. Manual "sync everything", disconnect, and reconnecting an existing TradeLingo database.
- Columns you add in Notion are never touched; columns you delete or rename are skipped and reported. Pages deleted in Notion are recreated. Chat text and phone numbers are never sent.
- `api.notion.com` is an optional permission, requested only when you connect Notion. The token is stored locally and excluded from backups unless you include keys.
- Today's follow-up links to each customer's Notion page.
- 新增：**Notion 同步**（单向，作战卡 → Notion）。粘贴 Notion 连接密钥、选择授权给连接的页面，插件自动创建“TradeLingo 商机”数据库（23 列），作战卡变化后几秒内写入；内容没变不重复发送。你在 Notion 里加的列不会被改动，删掉或改名的列自动跳过并提示，在 Notion 里删掉的页面会重新创建。不发送聊天原文和电话号码。只在连接 Notion 时申请访问 api.notion.com 的权限。今日跟进页可一键打开 Notion 页面。

## 0.9.0
- New: **English interface.** Settings → 界面语言 / Language: Auto (browser language), 中文 or English. Covers the toolbar, deal card, Today's follow-up, settings, setup wizard, notifications and error messages. Existing users stay on Chinese after updating; new installs follow the browser language, and the wizard has a language switch.
- In English mode, deal-card text written by DeepSeek is in English (internal values such as heat and "us/customer" are unchanged, so reminders and ranking work the same). Your own language is taken from "Translate incoming messages into", so back-translation and drafts work for non-Chinese users too. English sample quick phrases for new English users.
- New: **WhatsApp change alert.** If WhatsApp Web changes and messages, the message box or the current chat can no longer be recognised for about 15 seconds, a banner explains it, checks for an extension update in the background, and offers one-click diagnostics and a link to report it. Empty chats don't trigger it.
- 新增：**英文界面**（设置 → 界面语言：自动 / 中文 / English），覆盖工具条、作战卡、今日跟进、设置页、向导、通知和错误提示。老用户升级后保持中文；新安装跟随浏览器语言，向导右上角可切换。英文模式下 DeepSeek 用英文写作战卡，内部取值不变。
- 新增：**WhatsApp 改版预警**：连续约 15 秒认不出消息、输入框或当前聊天时，页面左下角给出提示，自动检查新版本，并可一键复制诊断信息、去反馈。空聊天不会误报。

## 0.8.0
- New: **first-run setup wizard** (opens after installing; also from settings). Recommends an engine, shows step-by-step instructions for getting a key (Qwen-MT / DeepL / DeepSeek), tests it, then sets default languages and uses only engines that have a key.
- New: **update alerts**. About once a day the extension reads the public `update.json` from GitHub (jsDelivr mirror as fallback). When a newer version exists: a red “新” badge on the toolbar icon, one desktop notification, and a banner at the top of settings with release notes, a download link and update steps. Can be turned off.
- New: **monthly usage** in settings — characters actually sent to each engine (cache hits not counted), including deal-card analysis, plus last month's total.
- 新增：**首次使用向导**（安装后自动打开，设置页也能打开）：推荐引擎、手把手申请 Key、测试、设置默认语言。
- 新增：**新版本提醒**：每天检查一次 GitHub 上的 `update.json`（打不开时用 jsDelivr 镜像），有新版时图标显示红色“新”、弹一次桌面通知、设置页顶部显示更新内容、下载链接和更新步骤；可关闭。
- 新增：**本月用量**：设置页显示各引擎本月实际发送的字符数（缓存命中不计，含作战卡）和上月合计。

## 0.7.1
- Reminders now also read unread counts from the WhatsApp chat list (local, every 10 s while WhatsApp Web is open, only for customers with a battle card), so a customer who wrote while the chat was closed still triggers "waiting for your reply". A reply sent from your phone (tick in the list preview) clears it.
- Diagnostics include chat-list detection. Illustrated manual updated with battle card, follow-up, reminders and backup chapters.
- 提醒会读取左侧聊天列表的未读数（本地、每 10 秒、只针对有作战卡的客户），没点开的聊天也能提醒；在手机上回复后自动解除。诊断信息加入聊天列表识别；说明书更新。

## 0.7.0
- New: follow-up reminders (desktop notifications for due/overdue promises and next steps, customers waiting longer than a set time) and a daily morning digest. Background check every 15 minutes, de-duplicated, at most 4 notifications at once; clicking opens Today's follow-up. Test-notification and check-now buttons.
- New: backup and restore (JSON; API keys optional). Imports merge: newer battle card wins, hand-picked chat languages win.
- 新增：跟进提醒与每日早报（每 15 分钟检查、去重、最多同时 4 条，点击打开今日跟进）；备份与恢复（可选含 API Key，导入时合并）。Edge 安装说明。

## 0.6.0
- New: **deal battle card** (DeepSeek only; translation settings unchanged). Heat with evidence, stage, estimated value, blockers, next step with one-click draft, commitments, price history, missing info with one-click follow-up questions, chat summary. Source messages shown on hover; phone numbers masked before sending.
- Incremental updates send only new messages; AI changes appear as suggestions (accept / ignore / accept all); hand-edited fields are locked. Red dot on the toolbar button when a chat has unanalysed messages (no API call).
- New: **Today's follow-up** page ranked by value × heat × urgency, computed locally; CSV export for Excel.
- 新增 **商机作战卡**（只用 DeepSeek，翻译设置不变）与 **今日跟进**；增量更新只发新消息，AI 改动需逐条采纳，手动修改的字段锁定；支持复制到 Excel、导出 CSV。

## 0.5.0
- Renamed to **TradeLingo** and open-sourced under the MIT License. Added icons. Settings are kept (storage keys unchanged).
- 项目更名为 **TradeLingo**，以 MIT 许可证开源；新增图标。存储键未改动，原有设置保留。

## 0.4.3
- Per-chat language detection rewritten: uses Chrome's built-in language detector (works without DeepL), also learns from your own outgoing foreign-language messages, recomputed every time a chat is opened.
- More robust chat identification (no longer affected by "online / typing…" in the header) and message direction detection (read ticks, bubble side). Diagnostics include language-detection details.
- 重做按客户识别语言：改用 Chrome 自带语言识别（不再依赖 DeepL），也参考你发出的外语消息，每次打开聊天重新计算。加固聊天识别与收发方向判断；诊断信息加入语言识别内容。

## 0.4.2
- Fixed: in WhatsApp's Lexical editor the translation was appended after the original text instead of replacing it. Fixed the "↩ 原文" button wrapping.
- 修复：在 WhatsApp 的 Lexical 输入框中，译文被追加到原文后面而不是替换原文；修复“↩ 原文”按钮被挤成竖排。

## 0.4.1
- Incoming messages in languages DeepL does not support (Bengali, Kazakh, etc.) are sent to the AI engines.
- 收到 DeepL 不支持的语言（孟加拉语、哈萨克语等）时，自动改用 AI 引擎翻译。

## 0.4.0
- Per-chat language memory, back-translation check, quick phrases (`/` + keyword).
- 新增：按客户记住语言、回译校对、快捷话术。

## 0.3.0
- Added Qwen-MT (Alibaba Cloud Model Studio) with glossary and domain hints; three-engine rotation and fallback.
- 新增 Qwen-MT 引擎（术语干预、领域提示），三引擎轮换与自动备用。

## 0.2.x
- Added DeepSeek; updated to current model names, thinking mode disabled, streaming responses with idle timeout.
- 新增 DeepSeek；更新为当前模型名，关闭思考模式，改为流式接收并按空闲时间判断超时。

## 0.1.x
- First version: DeepL translation of incoming messages, translate-before-send toolbar, diagnostics; fixed quoted replies being translated instead of the reply.
- 第一版：DeepL 翻译收到的消息、发送前翻译工具条、诊断功能；修复引用回复时误译引用内容。
