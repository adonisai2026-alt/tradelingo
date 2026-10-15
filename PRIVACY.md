# Privacy / 隐私说明

## English

TradeLingo runs entirely in your browser. It has no server of its own and collects no analytics.

**What is sent, and where**

| Data | Sent to | When |
|---|---|---|
| Text of messages being translated (incoming messages, your drafts, quick phrases, back-translations) | The translation provider you configured: DeepL (`api.deepl.com` / `api-free.deepl.com`), Alibaba Cloud Model Studio (`dashscope.aliyuncs.com` / `dashscope-intl.aliyuncs.com`) or DeepSeek (`api.deepseek.com`) | Only when a message is translated |
| Up to 8 recent messages of the open chat, as context | DeepSeek only, and only when "use recent chat as context" is enabled | When DeepSeek translates your reply |
| Up to the last 80 visible messages of the open chat, with time and sender ("us"/"customer"); phone numbers masked | DeepSeek only | Only when you click Generate / Update on the deal battle card |
| Your API key | The provider that issued it | With each request to that provider |
| Deal-card fields (customer name/company/country, heat, stage, estimated value, next step, promises, quotes, needs, terms, blockers, missing info, summary, reply status, last-message times); never chat text or phone numbers | Notion (`api.notion.com`), with your Notion connection token, into the database you chose | Only if you connect Notion: a few seconds after a deal card changes, or when you click Sync. The `api.notion.com` permission is requested only when you connect |
| Nothing (a plain download of the public `update.json` file; no data from you is included) | GitHub (`raw.githubusercontent.com`), or the jsDelivr mirror (`cdn.jsdelivr.net`) if GitHub is unreachable | At most about once a day, to check for a new version. Can be turned off in settings |

Each provider handles the text under its own privacy policy. Check it before translating sensitive content.

**What is stored locally** (`chrome.storage.local`, on your computer only): API keys, settings, glossary, quick phrases, a translation cache, per-chat language records, deal battle cards, monthly character counts per engine, and (if you connect Notion) your Notion token and which Notion page belongs to which customer. Per-chat records store only a hash of the chat ID, never phone numbers or names.

Follow-up reminders are computed locally from your saved battle cards and shown with your system's notifications; nothing is sent anywhere.

Backup files are saved where you choose. If you include API keys, keep the file private.

Language detection for per-chat language memory uses Chrome's built-in `chrome.i18n.detectLanguage`, which runs on your device.

**Diagnostics** (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>) copy only page structure and counts to your clipboard. Message text and phone numbers are removed. Nothing is sent anywhere unless you paste it yourself.

To remove all data, remove the extension in `chrome://extensions`.

## 简体中文

TradeLingo 完全在你的浏览器中运行，没有自己的服务器，也不收集任何统计数据。

**会发送什么、发给谁**

| 数据 | 发送给 | 何时发送 |
|---|---|---|
| 需要翻译的文字（收到的消息、你写的回复、快捷话术、回译内容） | 你所选的翻译服务商：DeepL、阿里云百炼或 DeepSeek | 只在翻译时发送 |
| 当前聊天最近 8 条消息（作为上下文） | 仅 DeepSeek，且只在勾选“参考最近聊天”时发送 | DeepSeek 翻译你的回复时 |
| 当前聊天最近最多 80 条可见消息（含时间、发送方“我方/客户”），电话号码已打码 | 仅 DeepSeek | 只在你点击作战卡的“生成”或“更新”时 |
| 你的 API Key | 签发该 Key 的服务商 | 每次向该服务商发起请求时 |
| 作战卡字段（客户名/公司/国家、热度、阶段、预估金额、下一步、承诺、报价、需求、条款、卡点、缺失信息、摘要、往来状态和最后消息时间）；不含聊天原文和电话号码 | Notion（`api.notion.com`），使用你的 Notion 连接密钥，写入你选择的数据库 | 只在你连接了 Notion 时：作战卡变化后几秒内，或你点“同步”时。访问 `api.notion.com` 的权限只在连接 Notion 时申请 |
| 不发送任何数据（只是下载公开的 `update.json` 文件读取最新版本号） | GitHub（`raw.githubusercontent.com`），打不开时用 jsDelivr 镜像（`cdn.jsdelivr.net`） | 大约每天一次，检查有没有新版本；可在设置里关闭 |

各服务商按照其自身的隐私政策处理这些文字，翻译敏感内容前请先了解相关政策。

**本地保存的内容**（`chrome.storage.local`，只在你的电脑上）：API Key、设置、术语表、快捷话术、翻译缓存、客户语言记录、商机作战卡、各引擎本月用量（字符数），以及（连接 Notion 时）Notion 密钥和客户对应的 Notion 页面。客户语言记录只保存聊天编号的哈希值，不保存电话号码或姓名。

跟进提醒根据本地保存的作战卡计算，通过系统通知显示，不会发送到任何地方。

备份文件保存在你选择的位置；如果包含了 API Key，请妥善保管，不要发给别人。

识别客户语言使用 Chrome 自带的 `chrome.i18n.detectLanguage`，在你的电脑上本地完成。

**诊断信息**（<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>）只把页面结构和统计数字复制到剪贴板，已去除消息内容和电话号码。除非你自己粘贴发出，否则不会发送到任何地方。

如需删除全部数据，在 `chrome://extensions` 中移除插件即可。
