# Changelog / 更新记录

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
