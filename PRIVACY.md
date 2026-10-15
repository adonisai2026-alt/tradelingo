# Privacy / 隐私说明

## English

TradeLingo runs entirely in your browser. It has no server of its own and collects no analytics.

**What is sent, and where**

| Data | Sent to | When |
|---|---|---|
| Text of messages being translated (incoming messages, your drafts, quick phrases, back-translations) | The translation provider you configured: DeepL (`api.deepl.com` / `api-free.deepl.com`), Alibaba Cloud Model Studio (`dashscope.aliyuncs.com` / `dashscope-intl.aliyuncs.com`) or DeepSeek (`api.deepseek.com`) | Only when a message is translated |
| Up to 8 recent messages of the open chat, as context | DeepSeek only, and only when "use recent chat as context" is enabled | When DeepSeek translates your reply |
| Your API key | The provider that issued it | With each request to that provider |

Each provider handles the text under its own privacy policy. Check it before translating sensitive content.

**What is stored locally** (`chrome.storage.local`, on your computer only): API keys, settings, glossary, quick phrases, a translation cache, and per-chat language records. Per-chat records store only a hash of the chat ID, never phone numbers or names.

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
| 你的 API Key | 签发该 Key 的服务商 | 每次向该服务商发起请求时 |

各服务商按照其自身的隐私政策处理这些文字，翻译敏感内容前请先了解相关政策。

**本地保存的内容**（`chrome.storage.local`，只在你的电脑上）：API Key、设置、术语表、快捷话术、翻译缓存、客户语言记录。客户语言记录只保存聊天编号的哈希值，不保存电话号码或姓名。

识别客户语言使用 Chrome 自带的 `chrome.i18n.detectLanguage`，在你的电脑上本地完成。

**诊断信息**（<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>）只把页面结构和统计数字复制到剪贴板，已去除消息内容和电话号码。除非你自己粘贴发出，否则不会发送到任何地方。

如需删除全部数据，在 `chrome://extensions` 中移除插件即可。
