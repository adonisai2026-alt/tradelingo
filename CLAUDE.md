# TradeLingo 项目说明（给 Claude Code）

TradeLingo 是给外贸业务员用的 WhatsApp Web 翻译与商机助手，开源（MIT）。作者是做低压电器出口的外贸经理，不是程序员：**和他沟通用简体中文、少用术语，先说结论**。

## 仓库结构

```
extension/      浏览器插件（Chrome / Edge，Manifest V3），无构建步骤、无依赖，直接加载这个文件夹
  i18n.js       界面语言（中文 / English）、tr() 翻译函数和英文词典 TL_EN
  common.js     默认设置 WADL_DEFAULTS、语言列表 WADL_LANGS、引擎名称
  dealcore.js   作战卡共用逻辑（显示、排序、提醒原因、手动编辑解析与合并、备份合并），无 DOM 依赖
  background.js 调用 DeepL / Qwen-MT / DeepSeek、缓存、自动备用引擎、作战卡分析、提醒、更新检查、Notion 同步入口
  notion.js     Notion 同步（单向：作战卡 → Notion 数据库）
  content.js    注入 WhatsApp Web：译文、工具条、回译、快捷话术、按聊天记语言、改版预警
  deal.js       作战卡面板、左侧聊天列表未读读取
  options.*     设置页     welcome.*  首次使用向导     deals.*  今日跟进页
tests/          自动测试（Playwright + tests/fixtures 里模拟的 WhatsApp 页面）
docs/           官网（GitHub Pages，域名 tradelingo.cn）、截图、图文说明书
update.json     插件每天读取它判断有没有新版本
DESIGN.md       设计规范：所有新界面必须照它做
```

## 必须遵守

1. **界面风格统一**：新界面先读 `DESIGN.md`，复用现有组件样式（工具条、回译框、菜单、卡片），颜色和圆角取规范里的值。
2. **界面文字**：所有用户看得到的文字都写中文原文并包在 `tr('中文', { 变量 })` 里，同时在 `extension/i18n.js` 的 `TL_EN` 加英文；HTML 静态文字由 `tlApplyI18n()` 按文字替换，带格式的段落用 `data-t="键"` + `TL_EN_HTML`。`tests/i18n-coverage.test.js` 会检查有没有漏。
3. **隐私底线**（不能退让）：
   - 没有自己的服务器。消息只从用户浏览器 / 电脑直接发给用户自己选的服务（DeepL、阿里云、DeepSeek、Notion）。
   - 用户没点按钮就不发送任何文字（划词时只选中不发送；作战卡只在点“生成 / 更新”时分析）。
   - 发给 AI 前电话号码打码；Notion 只同步作战卡字段，不同步聊天原文和号码；聊天只存编号的哈希。
   - API Key 只存在本地；备份默认不含 Key。
   - 新增任何“会把数据发到哪里”的功能，同步更新 `PRIVACY.md` 和官网隐私部分。
4. **插件从不替用户发送消息**，只填入输入框，由用户自己按 Enter。
5. **截图、示例数据一律用虚构客户和假号码**（如 +971 00 000 0000）。
6. **WhatsApp 页面会改版**：识别消息 / 输入框要多重兜底，认不出时走改版预警，不要静默失败。
7. 代码注释用中文，写“为什么”；函数尽量写成纯函数便于测试。

## 测试

```
cd tests && npm install      # 第一次需要（Playwright）
node run-all.js              # 全部测试；node run-all.js deal notion 只跑名字含 deal / notion 的
```

- 改任何代码后都要跑全部测试；新功能、修 bug 都要补测试（先写一个能复现问题的测试，再修）。
- 测试用模拟的 `chrome.*` 和 `tests/fixtures` 里的模拟 WhatsApp 页面，不会访问真实服务。
- 真实 WhatsApp 的页面结构只能推测，修完和 WhatsApp 页面相关的问题后，请作者实测，必要时让他在聊天里按 Alt+Shift+D 复制诊断信息。

## 发布新版本（插件）

1. `extension/manifest.json` 的 `version`；`extension/content.js` 里的 `VERSION` 和第 2 行版本说明。
2. `update.json`：`version`、`date`、`notes`（中文）、`notes_en`（英文）。插件靠它提醒用户更新。
3. `CHANGELOG.md`：英文 + 中文各一段。
4. 官网 3 处版本号：`docs/index.html` 的 `softwareVersion` 和“当前版本 v…”（中英文两处），`docs/install.html` 示意卡片上的版本号；功能有变化时同步改官网文案和 README（中英文）。
5. 打包：把 `extension` 文件夹压成 `tradelingo-extension-v版本.zip` 发给作者。
6. 提交作者用 GitHub noreply 邮箱：`adonisai2026-alt <342333333+adonisai2026-alt@users.noreply.github.com>`，不要用他的私人邮箱。

## 正在规划：桌面 App（Windows + macOS）

全局划词工具栏（类似飞书的 AI 划词工具栏）、任意输入框一键翻译 + 回译、截图翻译；第二期再做鼠标悬停取词和全局快捷话术。目前做**测试版，不做代码签名**。
- **先只做 Windows**，以后再加 macOS：读取选中文字、截图识别、快捷键、权限这些分系统的代码放在各自的模块里（Windows 先实现，macOS 留好位置），加 Mac 时不需要改动已做好的部分。
- 放在本仓库 `desktop/` 目录，技术选型倾向 Tauri（安装包小）；界面严格按 `DESIGN.md`。
- 翻译引擎、术语表、回译、界面语言要和插件**共用同一份逻辑**：把需要共用的部分抽到可被两边引用的模块，抽取时不能改变插件行为，抽完必须跑通 `tests/` 全部测试。
- 插件里的作战卡、今日跟进、Notion 同步属于 WhatsApp 场景，桌面 App 第一期不做。
