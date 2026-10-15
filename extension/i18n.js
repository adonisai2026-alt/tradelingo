// TradeLingo — 界面语言（中文 / English）
// 用法：tr('中文原文', { 变量 }) → 英文界面时返回词典里的英文，找不到就返回中文原文。
// 静态页面：tlApplyI18n(document.body) 按文字节点替换；带 data-t 的元素整段替换为 TL_EN_HTML 里的英文（可含 <b> 等标签）。
var TL_LANG = 'zh';

function tlDetectLang() {
  try { return /^zh/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '') ? 'zh' : 'en'; } catch (e) { return 'zh'; }
}

// v：'zh' / 'en' / 'auto'
function tlSetUiLang(v) {
  TL_LANG = v === 'zh' || v === 'en' ? v : tlDetectLang();
  try { if (typeof document !== 'undefined' && document.documentElement && !document.querySelector('#main, #app')) document.documentElement.lang = TL_LANG === 'en' ? 'en' : 'zh-CN'; } catch (e) { /* 忽略 */ }
  return TL_LANG;
}

function tr(zh, vars) {
  let s = TL_LANG === 'en' && Object.prototype.hasOwnProperty.call(TL_EN, zh) ? TL_EN[zh] : zh;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

// 语言名称：中文界面用中文名，英文界面用英文名
var TL_LANG_EN = { 'ZH-HANS': 'Chinese (Simplified)', 'ZH-HANT': 'Chinese (Traditional)', 'EN-US': 'English (US)', 'EN-GB': 'English (UK)', 'PT-BR': 'Portuguese (Brazil)', 'PT-PT': 'Portuguese (Portugal)' };
function tlLangName(l) {
  if (!l) return '';
  return TL_LANG === 'en' ? TL_LANG_EN[l[0]] || l[2] : l[1];
}
// 下拉框里的语言名：DeepL 不支持的加“（AI）”
function tlLangOption(l) { return tlLangName(l) + (l[3] ? '' : tr('（AI）')); }

function tlApplyI18n(root) {
  if (TL_LANG !== 'en' || !root) return;
  root.querySelectorAll('[data-t]').forEach((el) => {
    const h = TL_EN_HTML[el.getAttribute('data-t')];
    if (h !== undefined) el.innerHTML = h; // 固定文案，不含用户输入
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const raw = n.nodeValue;
    const key = raw.replace(/\s+/g, ' ').trim();
    if (key && Object.prototype.hasOwnProperty.call(TL_EN, key)) {
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      n.nodeValue = (lead ? ' ' : '') + TL_EN[key] + (trail ? ' ' : '');
    }
  }
  root.querySelectorAll('[placeholder], [title], [aria-label], [alt]').forEach((el) => {
    for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
      const v = el.getAttribute(a);
      if (v && Object.prototype.hasOwnProperty.call(TL_EN, v.trim())) el.setAttribute(a, TL_EN[v.trim()]);
    }
  });
  if (document.title && Object.prototype.hasOwnProperty.call(TL_EN, document.title)) document.title = TL_EN[document.title];
}

// ---------- 英文词典（键为中文原文） ----------
var TL_EN = {
  // Notion 同步
  'Notion 同步': 'Notion sync', 'Notion 响应超时': 'Notion timed out', 'Notion 密钥无效，请重新复制': 'Invalid Notion key, please copy it again',
  'Notion 拒绝了数据：{x}': 'Notion rejected the data: {x}', 'Notion 请求过于频繁，请稍后再试': 'Too many Notion requests, please try again shortly', 'Notion 返回错误 {s}': 'Notion error {s}',
  'TradeLingo 商机': 'TradeLingo deals', '✓ 上次同步 {t}：Notion 里共有 {n} 个客户': '✓ Last sync {t}: {n} customers in Notion',
  '✓ 密钥有效，但这个连接还看不到任何页面：请在 Notion 连接设置的“内容访问权限”里添加一个页面，然后再点一次“连接 Notion”': '✓ The key works, but this connection can\'t see any pages yet. Add a page under "Content access" in the Notion connection settings, then click "Connect Notion" again.',
  '✓ 已同步 {d} 个客户': '✓ Synced {d} customers', '✓ 已连接。选择一个页面，点“创建数据库”': '✓ Connected. Choose a page and click "Create database".',
  '✓ 数据库已就绪，已同步 {n} 个客户': '✓ Database ready; synced {n} customers', '✗ 同步了 {d} 个，{f} 个失败：{e}': '✗ Synced {d}, {f} failed: {e}',
  '✗ 需要允许插件访问 api.notion.com 才能同步': '✗ The extension needs permission to access api.notion.com to sync', '✗ {e}（{t}）': '✗ {e} ({t})',
  '使用这个': 'Use this one', '创建数据库': 'Create database',
  '只同步作战卡（客户、热度、阶段、金额、下一步、承诺、报价等），不发送聊天原文和电话号码。数据从浏览器直接发到 Notion，你在 Notion 里自己加的列不会被改动。': 'Only deal cards are synced (customer, heat, stage, value, next step, promises, quotes and so on), never chat text or phone numbers. Data goes straight from your browser to Notion, and columns you add yourself in Notion are left alone.',
  '在 Notion 中打开': 'Open in Notion', '在哪个页面下新建数据库': 'Create the database under this page', '已断开。Notion 里的数据仍然保留。': 'Disconnected. Your data in Notion is kept.',
  '已连接：{x} ↗': 'Connected: {x} ↗', '或者继续用已有的 TradeLingo 数据库': 'Or keep using an existing TradeLingo database',
  '找不到“{x}”列：请不要删除或改名客户名称列': 'Column "{x}" not found. Please don\'t delete or rename the customer name column.',
  '找不到页面或数据库：请确认已在 Notion 里把它授权给 Tradelingo 连接': 'Page or database not found. Make sure it is shared with the Tradelingo connection in Notion.',
  '断开': 'Disconnect', '断开后插件不再写入 Notion；Notion 里已有的数据不会删除。确定吗？': 'After disconnecting, the extension stops writing to Notion. Existing data in Notion is not deleted. Continue?',
  '未命名数据库': 'Untitled database', '未命名页面': 'Untitled page', '正在创建数据库并同步…': 'Creating the database and syncing…', '正在同步…': 'Syncing…',
  '正在同步中，请稍候': 'A sync is already running, please wait', '正在检查数据库并同步…': 'Checking the database and syncing…', '正在连接 Notion…': 'Connecting to Notion…',
  '立即全部同步': 'Sync everything now', '粘贴 Notion 连接密钥（ntn_…）': 'Paste your Notion connection key (ntn_…)', '网络错误，无法连接 Notion': 'Network error: couldn\'t reach Notion',
  '自动同步：作战卡有变化后几秒内写入 Notion': 'Sync automatically: write to Notion a few seconds after a deal card changes', '请先粘贴 Notion 连接密钥': 'Paste your Notion connection key first',
  '还没有允许插件访问 Notion：请在设置页点“连接 Notion”并允许': 'The extension isn\'t allowed to access Notion yet. Click "Connect Notion" in settings and allow it.',
  '这个数据库不是 TradeLingo 创建的（缺少“TradeLingo ID”列）。请让插件新建一个。': 'This database wasn\'t created by TradeLingo (no "TradeLingo ID" column). Let the extension create a new one.',
  '这个连接没有权限：请在 Notion 连接设置的“内容访问权限”里添加页面，并勾选读取、更新、插入内容': 'This connection has no access. In the Notion connection settings, add the page under "Content access" and enable read, update and insert content.',
  '连接 Notion': 'Connect Notion', '；已跳过被删除或改名的列：{x}': '; skipped deleted or renamed columns: {x}',
  '公司': 'Company', '国家': 'Country', '客户类型': 'Customer type', '下一步截止': 'Next step due', '我方承诺': 'Our promises', '承诺截止': 'Promise due',
  '客户最后消息': 'Last customer message', '我方最后回复': 'Our last reply', '优先级': 'Priority',
  // 标点
  '：': ': ', '、': ', ', '；': '; ', '（{x}）': ' ({x})', '（AI）': ' (AI)',
  // 通用
  '关闭': 'Close', '保存': 'Save', '取消': 'Cancel', '编辑': 'Edit', '删除': 'Delete', '采纳': 'Accept', '忽略': 'Ignore',
  '未知': 'Unknown', '未填写': 'Not set', '暂无': 'None yet', '空': 'empty', '（空）': '(empty)', '已复制': 'Copied', '复制失败': 'Copy failed',
  '后台无响应': 'No response from the extension background', '未知请求': 'Unknown request', '新': 'NEW',
  '{n} 分钟': '{n} min', '{n} 小时': '{n} h', '{n} 天': '{n} d', '{n} 字符': '{n} characters',
  '插件已更新或重载，请刷新 WhatsApp 页面': 'The extension was updated or reloaded. Please reload WhatsApp Web.',
  // 枚举
  '高': 'High', '中': 'Medium', '低': 'Low', '我方': 'Us', '客户': 'Customer',
  '询盘': 'Inquiry', '报价': 'Quotation', '样品': 'Sample', '谈判': 'Negotiation', '下单': 'Order', '售后': 'After-sales', '全部': 'All',
  '分销商': 'Distributor', '工程商': 'Contractor', '终端用户': 'End user', '贸易商': 'Trader',
  // 作战卡字段
  '热度': 'Heat', '阶段': 'Stage', '预估金额': 'Est. value', '需求': 'Needs', '条款': 'Terms', '卡点': 'Blockers', '下一步': 'Next step',
  '承诺记录': 'Promises', '报价记录': 'Price history', '缺失信息': 'Missing info', '摘要': 'Summary', '往来状态': 'Reply status', '分析时间': 'Analysed at',
  // 工具条
  '译': 'Translate', '话': 'Phrases', '单': 'Deal', '↩ 原文': '↩ Undo', '↺ 恢复自动识别': '↺ Back to auto-detect',
  '手动': 'Manual', '自动': 'Auto', '默认': 'Default',
  '快捷话术（也可在输入框输入 / 调出）': 'Quick phrases (or type / in the message box)',
  '翻译输入框内容（Alt+T）': 'Translate the message box (Alt+T)',
  '恢复翻译前的原文': 'Restore the text you wrote before translating',
  '发送翻译引擎：{e}（点击切换）': 'Engine for your replies: {e} (click to switch)',
  '只填写了一个引擎的 Key，无法切换': 'Only one engine has a key, so there is nothing to switch to',
  '已为这个聊天手动指定语言（选“恢复自动识别”可取消）': 'Language set by hand for this chat (choose "Back to auto-detect" to undo)',
  '根据客户消息自动识别的语言（手动选择后将固定为该语言）': 'Detected from the customer\'s messages (pick one to fix it for this chat)',
  '默认语言（客户发来消息后会自动识别；也可手动为这个聊天指定）': 'Default language (detected automatically once the customer writes; you can also set it for this chat)',
  '已恢复自动识别': 'Back to auto-detect', '已恢复自动识别（等客户发来消息后自动设置）': 'Back to auto-detect (set automatically once the customer writes)',
  // 翻译
  '翻译中…': 'Translating…', '（点击重试）': ' (click to retry)', '用 {e} 重新翻译': 'Retranslate with {e}', '正在用 {e} 重新翻译…': 'Retranslating with {e}…',
  '回译': 'Back-translation', '回译中…': 'Back-translating…', '按输入框当前内容重新回译（Alt+B）': 'Back-translate the current message box again (Alt+B)',
  '输入框内容已修改，点 ↻ 重新回译': 'The message box changed. Click ↻ to back-translate again',
  '没有找到输入框，请先打开一个聊天': 'Message box not found. Open a chat first.', '输入框是空的': 'The message box is empty',
  '无法自动写入输入框，译文已复制，请按 Ctrl+V 粘贴': 'Couldn\'t write into the message box. The translation is copied; press Ctrl+V to paste it.',
  '还没有快捷话术，请在插件设置中添加': 'No quick phrases yet. Add some in the extension settings.',
  '快捷话术 → {lang}　↑↓ 选择 · Enter 插入 · Esc 关闭': 'Quick phrases → {lang}   ↑↓ choose · Enter insert · Esc close',
  '正在翻译…': 'Translating…', '{label}原文': '{label} (your text)', '话术': 'Phrase', '正在翻译“{k}”…': 'Translating "{k}"…',
  '草稿': 'Draft', '正在翻译草稿…': 'Translating the draft…', '追问': 'Question', '正在翻译追问…': 'Translating the question…',
  '诊断信息已复制到剪贴板（不含消息内容），请粘贴发给开发者': 'Diagnostics copied (no message text). Please paste them to the developer.',
  '无法写入剪贴板，请按 F12 在 Console 中复制 [WADL] 诊断内容': 'Couldn\'t write to the clipboard. Press F12 and copy the [WADL] diagnostics from the Console.',
  // 改版预警
  '聊天消息': 'chat messages', '输入框': 'the message box', '当前聊天': 'Current chat',
  'TradeLingo 认不出 WhatsApp 页面上的：{what}': 'TradeLingo can\'t find {what} on the WhatsApp page',
  'WhatsApp 网页可能刚改版，翻译和工具条可能暂时不能正常工作。请先检查插件有没有新版本；没有的话，复制诊断信息反馈给开发者。': 'WhatsApp Web may have just changed, so translations and the toolbar may not work for now. Check for an extension update first; if there isn\'t one, copy the diagnostics and report it.',
  '检查插件更新': 'Check for updates', '复制诊断信息': 'Copy diagnostics', '去反馈': 'Report', '正在检查…': 'Checking…',
  '有新版本 v{v}，已打开下载页面。': 'Version {v} is available. The download page is open.',
  '暂时没有新版本。请复制诊断信息，到 GitHub Issues 反馈，开发者会尽快修复。': 'No update yet. Please copy the diagnostics and report it on GitHub Issues.',
  '无法连接 GitHub 检查更新：{e}': 'Couldn\'t reach GitHub to check for updates: {e}',
  '已复制（不含消息内容）。可以发到 GitHub Issues，或发给推荐你用这个插件的人。': 'Copied (no message text). Post it on GitHub Issues or send it to whoever recommended the extension to you.',
  // 作战卡面板
  '商机作战卡（DeepSeek 分析当前聊天）': 'Deal card (DeepSeek analyses this chat)', '商机作战卡：有 {n} 条新消息未分析': 'Deal card: {n} new messages not analysed yet',
  '依据：': 'Source:', '今日跟进': 'Today\'s follow-up', '按优先级查看所有客户': 'All customers by priority', '请先打开一个聊天。': 'Open a chat first.', '请先打开一个聊天': 'Open a chat first',
  '生成作战卡': 'Create deal card', '用 DeepSeek 分析当前聊天中可见的消息': 'Analyse the visible messages in this chat with DeepSeek',
  '将分析当前可见的 {n} 条消息（约 0.01 元）': 'Analyses the {n} visible messages (about ¥0.01)',
  '更新（{n} 条新消息）': 'Update ({n} new messages)', '只把新消息发给 DeepSeek，费用约为首次生成的一半': 'Sends only the new messages to DeepSeek, about half the cost of a full analysis',
  '没有新消息需要分析': 'No new messages to analyse', '重新生成': 'Regenerate', '从头分析当前可见的消息': 'Analyse the visible messages from scratch',
  '重新生成会覆盖你手动修改过的字段，确定吗？': 'Regenerating overwrites the fields you edited by hand. Continue?',
  '作战卡会告诉你：这个单有多热、卡在哪里、你答应过什么、报过什么价，以及下一句该说什么。': 'The deal card shows how hot the deal is, what\'s blocking it, what you promised, which prices were quoted, and what to say next.',
  '作战卡': 'Deal card', '分析于 {t} · DeepSeek': 'Analysed {t} · DeepSeek', '复制文本': 'Copy text', '已复制作战卡文本': 'Deal card copied',
  '复制到 Excel': 'Copy to Excel', '已复制，可直接粘贴到 Excel': 'Copied. Paste it straight into Excel.', '复制为表格（含表头）': 'Copy as a table (with headers)',
  '复制失败，请重试': 'Copy failed, please try again', '✎ 已手动': '✎ Edited', '手动修改；修改后 AI 更新不会覆盖它': 'Edit by hand; AI updates won\'t overwrite it',
  '估算：': 'Estimate: ', '预估金额（估计）': 'Est. value', '判断依据：': 'Why: ', '改{x}': 'Edit {x}',
  '起草这条消息': 'Draft this message', '翻译成当前客户的语言并填入输入框，确认后自己发送': 'Translates into the customer\'s language and fills the message box. You send it yourself.',
  '把这句写给客户': 'Write this to the customer', '暂未发现': 'None found', '未提及': 'Not mentioned', '已逾期': 'overdue', '今天到期': 'due today', '截止 {x}': 'due {x}',
  '关键信息都已明确': 'All key information is known', '生成追问': 'Ask', 'AI 更新建议（{n}）': 'AI suggestions ({n})', '全部采纳': 'Accept all',
  '（你手动改过）': ' (you edited this)', '进展摘要': 'Progress', '待办': 'To do', '我方要做': 'We need to', '等客户': 'Waiting on the customer',
  '当前聊天里没有可分析的文字消息': 'No text messages to analyse in this chat', '没有新消息': 'No new messages',
  'DeepSeek 正在分析 {n} 条新消息…': 'DeepSeek is analysing {n} new messages…', 'DeepSeek 正在分析 {n} 条消息…': 'DeepSeek is analysing {n} messages…',
  '已分析新消息，作战卡无需改动': 'New messages analysed. No changes to the deal card.',
  // dealcore
  '目标价 {x}': 'target {x}', '（{x} 前）': ' (by {x})', '（截止 {x}）': ' (due {x})',
  '客户有 {n} 条未读，已等 {t}': 'Customer has {n} unread, waiting {t}', '客户在等你回复：{t}': 'Customer waiting for your reply: {t}', '等待客户回复：{t}': 'Waiting for the customer: {t}',
  '我方承诺已逾期：{x}': 'Our promise overdue: {x}', '我方承诺今天到期：{x}': 'Our promise due today: {x}', '下一步已逾期': 'Next step overdue', '下一步今天到期': 'Next step due today',
  '客户 {n} 天未回复': 'No reply for {n} days', '{n} 条新消息未分析': '{n} new messages not analysed', '缺：{x}': 'Missing: {x}',
  '未命名客户': 'Unnamed customer', '【商机作战卡】{x}': '[Deal card] {x}',
  // 提醒与通知
  '今日跟进：{n} 个客户需要处理': 'Today\'s follow-up: {n} customers need attention', '承诺已逾期': 'Promise overdue', '承诺今天到期': 'Promise due today',
  '我方承诺：{x}': 'We promised: {x}', '客户在等你回复：{x}': 'Customer waiting for your reply: {x}', '已等待 {t}': 'Waiting {t}',
  '还有 {n} 条跟进提醒': '{n} more follow-up reminders', '点击打开今日跟进查看全部': 'Click to open Today\'s follow-up',
  'TradeLingo 测试通知': 'TradeLingo test notification', '能看到这条通知，说明跟进提醒可以正常弹出。': 'If you can see this, follow-up reminders will work.',
  '通知没有弹出：请检查系统通知设置是否允许 Chrome / Edge 发送通知': 'The notification didn\'t show. Check that your system allows notifications from Chrome / Edge.',
  'TradeLingo：有新版本，点击查看': 'TradeLingo: an update is available, click to see it', 'TradeLingo 有新版本 v{v}': 'TradeLingo {v} is available', '点击查看更新内容和下载': 'Click to see what\'s new and download',
  '更新信息格式不对': 'Invalid update information', '连接超时': 'connection timed out', '无法连接 GitHub（{e}）': 'Couldn\'t reach GitHub ({e})',
  // 引擎错误
  'DeepL 响应超时': 'DeepL timed out', '网络错误，无法连接 DeepL': 'Network error: couldn\'t reach DeepL', 'DeepL API Key 无效': 'Invalid DeepL API key',
  '本月 DeepL 字符额度已用完': 'DeepL character quota for this month is used up', 'DeepL 请求过于频繁，请稍后再试': 'Too many DeepL requests, please try again shortly',
  '文本过长': 'Text too long', 'DeepL 参数错误：': 'DeepL parameter error: ', 'DeepL 返回错误 {s}': 'DeepL error {s}',
  'DeepSeek 响应超时': 'DeepSeek timed out', '网络错误，无法连接 DeepSeek': 'Network error: couldn\'t reach DeepSeek', 'DeepSeek API Key 无效': 'Invalid DeepSeek API key',
  'DeepSeek 账户余额不足': 'DeepSeek balance is too low', 'DeepSeek 请求过于频繁，请稍后再试': 'Too many DeepSeek requests, please try again shortly', 'DeepSeek 请求错误：': 'DeepSeek request error: ',
  'DeepSeek 服务器繁忙，请稍后再试': 'DeepSeek servers are busy, please try again shortly', 'DeepSeek 返回错误 {s}': 'DeepSeek error {s}', 'DeepSeek 返回格式异常': 'Unexpected response from DeepSeek',
  'DeepSeek 返回了空白内容': 'DeepSeek returned an empty response', 'DeepSeek 返回内容不完整（被截断）': 'DeepSeek\'s response was cut off', 'DeepSeek 没有返回内容': 'DeepSeek returned nothing',
  'DeepSeek 连接卡住（25 秒无数据），可能是网络或代理问题': 'DeepSeek stalled (no data for 25 s), possibly a network or proxy problem', 'DeepSeek 响应超时（超过 90 秒）': 'DeepSeek timed out (over 90 s)',
  'DeepSeek 返回的作战卡格式异常，请重试': 'DeepSeek returned an invalid deal card, please try again',
  '阿里云账户欠费，请到阿里云费用中心充值': 'Your Alibaba Cloud account is overdue. Top it up in the Alibaba Cloud billing centre.',
  'Qwen-MT 响应超时': 'Qwen-MT timed out', '网络错误，无法连接阿里云百炼': 'Network error: couldn\'t reach Alibaba Cloud Model Studio',
  'Qwen-MT API Key 无效（注意：北京地域的 Key 不能用于国际地域，反之亦然）': 'Invalid Qwen-MT API key (note: a Beijing-region key doesn\'t work in the international region, and vice versa)',
  'Qwen-MT 无权限：请确认已在百炼开通该模型（{x}）': 'No permission for Qwen-MT: make sure the model is enabled in Model Studio ({x})',
  'Qwen-MT 请求过于频繁，请稍后再试': 'Too many Qwen-MT requests, please try again shortly', 'Qwen-MT 请求错误：': 'Qwen-MT request error: ', 'Qwen-MT 返回错误 {s}': 'Qwen-MT error {s}', 'Qwen-MT 没有返回内容': 'Qwen-MT returned nothing',
  '请先点击工具栏的插件图标，填写至少一个翻译引擎的 API Key': 'Click the extension icon in the toolbar and add at least one translation engine API key',
  'DeepL 不支持该语言，请填写 Qwen-MT 或 DeepSeek 的 Key': 'DeepL doesn\'t support this language. Add a Qwen-MT or DeepSeek key.',
  '尚未填写 {e} 的 API Key': 'No API key for {e} yet', '{a} 出错（{err}），已改用 {b}': '{a} failed ({err}), used {b} instead', 'DeepL 不支持该语言，已用 {b}': 'DeepL doesn\'t support this language, used {b}',
  '请先填写 API Key': 'Enter an API key first', '连接成功（{plan}）：本期已用 {used} / {limit} 字符（{pct}%）': 'Connected ({plan}): {used} / {limit} characters used this period ({pct}%)',
  '连接成功（{t}s）：试译 “{x}”': 'Connected ({t}s). Test translation: "{x}"', '第 1 步（连接 / 余额）失败：{e}': 'Step 1 (connection / balance) failed: {e}',
  '第 1 步通过（{t}s），但账户余额不足：{b}': 'Step 1 passed ({t}s), but the balance is too low: {b}', '第 1 步通过（{t}s，余额 {b}）；第 2 步（试译）失败：{e}': 'Step 1 passed ({t}s, balance {b}); step 2 (test translation) failed: {e}',
  '连接成功：余额 {b}（{t1}s）；试译 “{x}”（{t2}s）': 'Connected: balance {b} ({t1}s). Test translation: "{x}" ({t2}s)',
  '商机功能使用 DeepSeek，请先在设置页填写 DeepSeek API Key': 'Deal cards use DeepSeek. Add a DeepSeek API key in settings first.',
  // 设置页
  'TradeLingo 设置': 'TradeLingo settings', '🎉 发现新版本': '🎉 New version', '你现在是 v': 'You\'re on v', ' · 新版发布于 {d}': ' · released {d}',
  '下载新版（ZIP）': 'Download (ZIP)', '完整更新说明': 'Full changelog', '怎么更新？（1 分钟，设置和作战卡都会保留）': 'How to update (1 minute; settings and deal cards are kept)',
  '下载 ZIP 并解压。': 'Download the ZIP and unzip it.', '刷新 WhatsApp 网页。': 'Reload WhatsApp Web.',
  '第一次使用？跟着向导 3 步填好 API Key。': 'First time? The wizard sets up your API key in 3 steps.', '打开使用向导': 'Open setup wizard',
  '粘贴 DeepL API Key': 'Paste your DeepL API key', '显示/隐藏': 'Show / hide', '保存并测试': 'Save & test',
  '免费版 Key 以 “:fx” 结尾，插件会自动选择对应的接口地址。': 'Free-plan keys end in ":fx"; the extension picks the right endpoint automatically.',
  '阿里云百炼 sk-…': 'Model Studio key sk-…', '模型': 'Model', '地域': 'Region', '华北2（北京）— 推荐，价格最低': 'China (Beijing): lowest price', '新加坡（国际）': 'Singapore (international)',
  '专用翻译模型，支持 92 种语言（含孟加拉语、哈萨克语、乌兹别克语）。术语表会自动作为“术语干预”传给 Qwen-MT。Key 与地域绑定，请选择创建 Key 时所在的地域。': 'A dedicated translation model for 92 languages, including Bengali, Kazakh and Uzbek. Your glossary is passed to Qwen-MT as terminology. Keys are tied to a region, so choose the region where you created the key.',
  '在 platform.deepseek.com 创建 Key（按用量计费，需要先充值）。翻译建议用 deepseek-flash；插件已关闭“思考模式”，响应更快。': 'Create a key at platform.deepseek.com (pay as you go; top up first). deepseek-flash is recommended for translation; thinking mode is turned off for faster replies.',
  'deepseek-flash（快、便宜，推荐）': 'deepseek-flash (fast, cheap, recommended)', 'deepseek-v4-pro（更强、更贵）': 'deepseek-v4-pro (stronger, pricier)',
  'qwen-mt-flash（快、便宜，推荐）': 'qwen-mt-flash (fast, cheap, recommended)', 'qwen-mt-plus（质量最高）': 'qwen-mt-plus (best quality)', 'qwen-mt-lite（最快，语种较少）': 'qwen-mt-lite (fastest, fewer languages)',
  '界面语言 / Language': '界面语言 / Language', '自动（跟随浏览器）': 'Auto (browser language)', '中文': '中文',
  '启用插件': 'Enable the extension', '自动翻译收到的消息': 'Translate incoming messages automatically', '同时翻译我发出的消息（便于核对译文）': 'Also translate my own messages (to check them)',
  '按聊天自动识别客户语言（每个客户单独记住）': 'Detect each customer\'s language (remembered per chat)', '翻译后显示回译（把译文翻回中文核对）': 'Show a back-translation after translating (to check the meaning)',
  '收到的消息': 'Incoming messages', '翻译引擎': 'Engine', '译成': 'Translate into', '发送的回复': 'Your replies', '默认译成': 'Default language', '语气': 'Tone',
  '自然': 'Natural', '正式商务': 'Formal business', '友好简洁': 'Friendly and short',
  'DeepSeek 翻译时参考最近 8 条聊天（Qwen-MT 不支持上下文）': 'DeepSeek uses the last 8 messages as context (Qwen-MT doesn\'t support context)',
  '标有“（AI）”的语言 DeepL 不支持，会自动改用 Qwen-MT 或 DeepSeek。一个引擎出错时，插件会按 Qwen-MT → DeepL → DeepSeek 的顺序自动改用其他已填 Key 的引擎。': 'Languages marked "(AI)" aren\'t supported by DeepL and use Qwen-MT or DeepSeek instead. If an engine fails, the extension tries the other engines that have a key, in the order Qwen-MT → DeepL → DeepSeek.',
  'DeepL（速度快）': 'DeepL (fast)', 'Qwen-MT（专业翻译）': 'Qwen-MT (translation model)', 'DeepSeek（懂上下文）': 'DeepSeek (uses context)',
  '商机作战卡': 'Deal cards', '打开今日跟进': 'Open Today\'s follow-up',
  '在 WhatsApp 工具条上点“单”，DeepSeek 会把当前聊天整理成作战卡：热度、阶段、预估金额、卡点、承诺和报价记录、下一步，并能一键起草消息。商机功能只使用 DeepSeek，翻译设置不受影响。': 'Click "Deal" on the WhatsApp toolbar and DeepSeek turns the chat into a deal card: heat, stage, estimated value, blockers, promises, price history and the next step, with a one-click draft. Deal cards use DeepSeek only; your translation settings are unaffected.',
  '跟进提醒': 'Follow-up reminders', '桌面提醒：我方承诺或下一步到期、客户等你回复': 'Desktop reminders: promises or next steps due, customers waiting for a reply',
  '客户等你回复超过': 'Remind when a customer has waited', '2 小时': '2 hours', '4 小时': '4 hours', '8 小时': '8 hours', '24 小时': '24 hours',
  '每日早报：今天要跟进哪些客户': 'Morning digest: who to follow up today', '早报时间': 'Digest time',
  '07:00 之后': 'After 07:00', '08:00 之后': 'After 08:00', '09:00 之后': 'After 09:00', '10:00 之后': 'After 10:00', '11:00 之后': 'After 11:00',
  '发送测试通知': 'Send a test notification', '立即检查一次': 'Check now',
  '✓ 已发送测试通知，请看屏幕右下角（或通知中心）': '✓ Test notification sent. Look at the corner of your screen (or the notification centre).',
  '✓ 已发出 {n} 条提醒': '✓ Sent {n} reminders', '✓ 现在没有需要提醒的事项': '✓ Nothing to remind you about right now',
  '浏览器开着就会每 15 分钟检查一次，不需要打开 WhatsApp，也不消耗 Token。“客户等你回复”同时参考你打开聊天时看到的消息，以及左侧聊天列表的未读数（WhatsApp 网页开着时每 10 秒读取一次，只针对已有作战卡的客户）。如果测试通知没有弹出，请在系统设置中允许 Chrome / Edge 发送通知。': 'While the browser is open, the extension checks every 15 minutes, even without WhatsApp open, and uses no tokens. "Waiting for your reply" uses the messages you saw in each chat plus unread counts in the chat list (read every 10 s while WhatsApp Web is open, only for customers with a deal card). If the test notification doesn\'t appear, allow notifications from Chrome / Edge in your system settings.',
  '备份与恢复': 'Backup and restore', '备份中包含 API Key（只在自己的电脑之间迁移时勾选）': 'Include API keys (only when moving between your own computers)',
  '导出备份': 'Export backup', '导入备份': 'Import backup',
  '备份包括：作战卡、快捷话术、术语表、每个客户的语言记录和全部设置。导入时与现有数据合并：同一个客户保留分析时间较新的作战卡，手动指定的语言优先。也可以用来把数据搬到 Edge 或另一台电脑。': 'A backup contains deal cards, quick phrases, glossary, per-chat languages and all settings. Importing merges with existing data: the newer deal card wins, and languages you set by hand win. Also handy for moving to Edge or another computer.',
  'TradeLingo-备份-{d}.json': 'TradeLingo-backup-{d}.json', '✓ 已导出：{d} 张作战卡、{l} 条客户语言记录': '✓ Exported {d} deal cards and {l} chat languages', '（含 API Key，请妥善保管）': ' (includes API keys, keep it private)',
  '✗ 文件不是有效的备份（JSON 格式错误）': '✗ Not a valid backup (invalid JSON)', '✗ 这不是 TradeLingo 的备份文件': '✗ This isn\'t a TradeLingo backup',
  '✓ 已导入：新增 {a} 张、更新 {u} 张作战卡，{l} 条语言记录，{s} 项设置': '✓ Imported: {a} new and {u} updated deal cards, {l} chat languages, {s} settings', '（含 API Key）': ' (including API keys)',
  '术语表': 'Glossary', '每行一条，例如：\n断路器 = circuit breaker\n交期 = lead time\n塑壳断路器 = MCCB': 'One per line, for example:\nMCCB = moulded case circuit breaker\nlead time = délai de livraison',
  'Qwen-MT 和 DeepSeek 翻译时都会使用这些译法，保证专业用词统一。格式：每行“原文 = 译文”。': 'Qwen-MT and DeepSeek use these translations to keep your terminology consistent. Format: one "source = translation" per line.',
  '快捷话术': 'Quick phrases', '每行一条：关键词 | 中文内容': 'One per line: keyword | text',
  '本月用量': 'Usage this month', '通义千问 Qwen-MT': 'Qwen-MT', 'DeepSeek 翻译': 'DeepSeek translation', 'DeepSeek 商机作战卡': 'DeepSeek deal cards', '上月（{m}）合计': 'Last month ({m}) total',
  '统计的是真正发给翻译服务的字符数，缓存命中不计。实际费用以各平台账单为准：DeepL 免费版每月 50 万字符（填了 DeepL Key 时，上面的“保存并测试”会显示官方统计的已用量）；DeepSeek 点“保存并测试”可查余额；通义千问在阿里云费用中心查看。': 'Counts the characters actually sent to each service; cached translations are not counted. Your provider\'s bill is what counts: DeepL Free includes 500,000 characters a month ("Save & test" above shows DeepL\'s official count); "Save & test" for DeepSeek shows your balance; check Qwen-MT in the Alibaba Cloud billing centre.',
  '版本与更新': 'Version and updates', '每天自动检查一次新版本（只读取 GitHub 上的版本号，不上传任何数据）': 'Check for a new version once a day (only reads the version number from GitHub; nothing is uploaded)',
  '立即检查更新': 'Check for updates now', '使用向导': 'Setup wizard',
  '当前版本 v{v}，还没有检查过更新': 'Version {v}. Not checked for updates yet', '✗ {e} · {t}。可以稍后再试，或直接到 GitHub 查看': '✗ {e} · {t}. Try again later or check GitHub directly',
  '有新版本 v{v}（见页面顶部）· 检查于 {t}': 'Version {v} is available (see the top of this page) · checked {t}', '✓ 已是最新版本 v{v} · 检查于 {t}': '✓ Up to date ({v}) · checked {t}',
  '清空翻译缓存': 'Clear translation cache', '已翻译过的内容会缓存在本地，重复出现时不再消耗额度。': 'Translations are cached locally, so repeated text doesn\'t use your quota again.', '✓ 缓存已清空': '✓ Cache cleared',
  '已清除 API Key': 'API key removed', '正在连接 {e}…': 'Connecting to {e}…', '已填写（点“保存并测试”试译一句）': 'Saved (click "Save & test" for a test translation)', '已填写（点“保存并测试”检查余额）': 'Saved (click "Save & test" to check the balance)',
  // 今日跟进页
  '今日跟进 · TradeLingo': 'Today\'s follow-up · TradeLingo', '导出 Excel（CSV）': 'Export to Excel (CSV)',
  '按 预估金额 × 热度 × 紧急度 排序，全部在本地计算，不消耗 Token。': 'Ranked by estimated value × heat × urgency, computed locally, no tokens used.',
  '共 {n} 个客户 · 按 预估金额 × 热度 × 紧急度 排序，全部在本地计算，不消耗 Token。': '{n} customers · ranked by estimated value × heat × urgency, computed locally, no tokens used.',
  '这个阶段没有客户。': 'No customers at this stage.', '还没有作战卡。在 WhatsApp 中打开客户聊天，点工具条上的“单”生成第一张。': 'No deal cards yet. Open a customer chat in WhatsApp and click "Deal" on the toolbar to create one.',
  '热度 {x}': 'Heat {x}', '金额未知': 'Value unknown', '暂无紧急事项': 'Nothing urgent', '下一步：': 'Next step: ', '复制作战卡': 'Copy deal card',
  '删除“{x}”的作战卡？此操作不能撤销。': 'Delete the deal card for "{x}"? This can\'t be undone.', 'TradeLingo-商机-{d}.csv': 'TradeLingo-deals-{d}.csv',
  '提示：在 WhatsApp 中打开某个客户的聊天，点工具条上的“单”可以生成或更新作战卡。热度和金额是 AI 的估计，以聊天原文为准。': 'Tip: open a customer chat in WhatsApp and click "Deal" on the toolbar to create or update a deal card. Heat and value are AI estimates; the chat itself is the source of truth.',
  // 向导
  '欢迎使用 TradeLingo': 'Welcome to TradeLingo', '3 步设置好，就能在 WhatsApp 网页里看懂、回复各国客户。': 'Three steps, and you can read and answer customers in any language on WhatsApp Web.',
  '① 选翻译引擎': '① Engine', '② 填写 API Key': '② API key', '③ 设置语言': '③ Languages', '④ 开始使用': '④ Start',
  '选一个翻译引擎': 'Choose a translation engine', '插件本身免费，翻译由你自己的翻译服务账号完成（按用量付费或免费额度）。先选一个就够用，以后可以在设置里再加。': 'The extension is free. Translation runs on your own account with the provider (free quota or pay as you go). One engine is enough to start; you can add more in settings later.',
  '推荐': 'Recommended', '注册门槛高': 'Card required',
  '阿里云出品，国内手机号 / 支付宝就能注册开通': 'By Alibaba Cloud; the international Model Studio site works outside China',
  '专业翻译模型，支持 92 种语言，包括孟加拉语、哈萨克语、乌兹别克语等小语种': 'Dedicated translation model for 92 languages, including Bengali, Kazakh and Uzbek',
  '按用量计费，聊天这种短文本用量很小': 'Pay as you go; short chat messages cost very little',
  '速度快、质量稳定，免费版每月 50 万字符': 'Fast and reliable; the free plan includes 500,000 characters a month',
  '注册需要绑定海外支持的信用卡，国内很多人卡在这一步': 'Sign-up needs a credit card for verification (the free plan isn\'t charged)',
  '不支持孟加拉语、哈萨克语、印地语、越南语、泰语等': 'Doesn\'t support Bengali, Kazakh, Hindi, Vietnamese, Thai and some others',
  '能参考聊天上下文，可以调语气': 'Uses chat context and can adjust the tone', '“商机作战卡”功能必须用 DeepSeek': 'Deal cards require DeepSeek',
  '需要先充值才能用；翻译速度比前两个慢': 'Needs a prepaid balance; slower than the other two',
  '照着下面做，大约 5 分钟。Key 只保存在你自己的浏览器里，不会上传到任何地方。': 'Follow these steps; it takes about 5 minutes. Your key is stored only in your own browser and never uploaded.',
  '获取通义千问 Qwen-MT 的 API Key': 'Get a Qwen-MT API key', '获取 DeepL 的 API Key': 'Get a DeepL API key', '获取 DeepSeek 的 API Key': 'Get a DeepSeek API key',
  '粘贴以 sk- 开头的 Key': 'Paste the key starting with sk-', '粘贴 DeepL Key（免费版以 :fx 结尾）': 'Paste your DeepL key (free-plan keys end in :fx)',
  '打开 <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener">阿里云百炼控制台</a>，用阿里云账号登录（没有账号可以用手机号或支付宝注册，并按提示完成实名认证）。': 'Open the Alibaba Cloud Model Studio console (<a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener">China</a> or <a href="https://modelstudio.console.alibabacloud.com/" target="_blank" rel="noopener">international</a>) and sign in or create an Alibaba Cloud account.',
  '第一次进入时，按页面提示开通百炼服务（按用量付费，不用的话不收费）。': 'The first time, activate Model Studio when prompted (pay as you go; nothing is charged if you don\'t use it).',
  '在控制台找到 <b>API-KEY</b>（密钥管理）页面，点 <b>创建 API-KEY</b>，复制以 sk- 开头的 Key。': 'Open the <b>API Key</b> page in the console, click <b>Create API Key</b> and copy the key starting with sk-.',
  '粘贴到下面，地域选 <b>北京</b>（如果你是在阿里云国际站创建的 Key，选“新加坡”），然后点“保存并测试”。': 'Paste it below, choose the region where you created the key (<b>Singapore</b> for the international site, <b>Beijing</b> for the China site) and click "Save & test".',
  '账户欠费时翻译会停止，记得在阿里云费用中心留一点余额。': 'Translation stops if your account is overdue, so keep a small balance in the Alibaba Cloud billing centre.',
  '打开 <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener">DeepL API 页面</a>，选择 <b>DeepL API Free</b>（免费版）注册。': 'Open the <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener">DeepL API page</a> and sign up for <b>DeepL API Free</b>.',
  '按提示填写信用卡做身份验证（免费版不会扣费）。需要 DeepL 支持的国家/地区发行的卡，国内不少卡会失败。': 'Enter a credit card for verification when asked (the free plan isn\'t charged). The card must be issued in a country DeepL supports.',
  '登录后进入 <b>账户（Account）→ API Keys</b>，复制 Key。': 'Go to <b>Account → API Keys</b> and copy your key.',
  '粘贴到下面，点“保存并测试”。': 'Paste it below and click "Save & test".',
  'DeepL 不支持孟加拉语、哈萨克语、越南语、泰语等。遇到这些客户时，插件需要通义千问或 DeepSeek 的 Key 才能翻译，以后可以在设置页补上。': 'DeepL doesn\'t support Bengali, Kazakh, Vietnamese, Thai and some others. For those customers you\'ll need a Qwen-MT or DeepSeek key, which you can add in settings later.',
  '打开 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener">DeepSeek 开放平台</a>，用手机号注册登录。': 'Open the <a href="https://platform.deepseek.com/" target="_blank" rel="noopener">DeepSeek platform</a> and sign up or sign in.',
  '在 <b>充值</b> 页面先充一点余额（按用量计费，余额为 0 时无法调用）。': 'Add a small balance on the <b>Top up</b> page (pay as you go; it won\'t work with a zero balance).',
  '进入 <b>API keys</b> 页面，点 <b>创建 API key</b>，复制以 sk- 开头的 Key（只显示一次，请马上保存）。': 'On the <b>API keys</b> page, click <b>Create API key</b> and copy the key starting with sk- (it\'s shown only once).',
  '粘贴到下面，点“保存并测试”，会同时显示账户余额。': 'Paste it below and click "Save & test"; your balance is shown too.',
  '地域：北京（国内账号选这个）': 'Region: Beijing (China site)', '地域：新加坡（国际站账号）': 'Region: Singapore (international site)',
  '上一步': 'Back', '先跳过': 'Skip for now', '已填写过 Key，点“保存并测试”确认一下': 'A key is already saved. Click "Save & test" to check it.',
  '请先粘贴 Key': 'Paste a key first', '这看起来是通义千问或 DeepSeek 的 Key（以 sk- 开头），不是 DeepL 的。请返回上一步选对引擎。': 'That looks like a Qwen-MT or DeepSeek key (it starts with sk-), not a DeepL key. Go back and choose the right engine.',
  '正在连接，最多需要十几秒…': 'Connecting, this can take up to 15 seconds…', '。请确认 Key 复制完整，并检查地域选得对不对。': '. Check that the whole key was copied and the region is right.',
  '设置语言': 'Set your languages', '每个客户用什么语言，插件会自动识别并分别记住，这里只是默认值。': 'The extension detects and remembers each customer\'s language. These are just defaults.',
  '客户消息翻译成': 'Translate customer messages into', '我回复时默认译成': 'Translate my replies into', '例如客户发阿拉伯语，你回复时会自动译成阿拉伯语；还没识别出语言的新客户，才用上面的默认语言。': 'For example, if a customer writes in Arabic, your replies are translated into Arabic. The default above is only used until a new customer\'s language is detected.',
  '提示：“商机作战卡”需要 DeepSeek 的 Key，以后想用时在设置页填上即可，翻译不受影响。': 'Note: deal cards need a DeepSeek key. Add one in settings whenever you want them; translation works without it.',
  '完成设置': 'Finish', '✓ 设置完成': '✓ All set', '打开 WhatsApp 网页，点开任意客户聊天就能看到译文。如果 WhatsApp 网页已经开着，请先刷新一下。': 'Open WhatsApp Web and any customer chat to see translations. If WhatsApp Web is already open, reload it first.',
  '客户发来的消息，下方自动出现中文译文': 'A translation appears under each customer message',
  '在输入框写中文，点工具条上的“译”（或按 Alt+T）变成客户的语言，黄色框里是回译，核对后自己按 Enter 发送': 'Write in your language and click "Translate" (or Alt+T) to switch to the customer\'s language. The yellow box shows a back-translation; check it, then press Enter yourself.',
  '在输入框输入 / 加关键词（如 /交期）调出常用话术，自动翻译': 'Type / plus a keyword (such as /leadtime) for a saved phrase, translated automatically',
  '把当前聊天整理成商机作战卡（需要 DeepSeek Key）': 'Turns the chat into a deal card (needs a DeepSeek key)',
  '打开设置页': 'Open settings', '打开 WhatsApp 网页': 'Open WhatsApp Web',
  'TradeLingo 是独立开源项目，与 WhatsApp / Meta 无关。消息只会从你的浏览器直接发给你选择的翻译服务，没有任何中转服务器。': 'TradeLingo is an independent open-source project, not affiliated with WhatsApp or Meta. Messages go straight from your browser to the translation service you choose; there is no server in between.'
};

var TL_EN_HTML = {
  'opt.notion.calendar': 'To see follow-ups by date in Notion, open the database and click <b>+ Add view</b> → <b>Calendar</b>, showing by "Next step due" or "Promise due". It also works in the Notion mobile app.',
  'opt.notion.howto': 'Before you start: at <b>notion.so/profile/integrations</b> (Developer tools → Connections) create an internal connection with read, update and insert content; create an empty page in Notion and add it under the connection\'s "Content access"; then paste the connection\'s API token above.',
  'opt.upd.step2': 'Copy everything inside the unzipped <b>extension</b> folder into the folder you originally installed from, replacing the old files.<br><span class="hint">Always overwrite the original folder. A new folder starts with empty settings.</span>',
  'opt.upd.step3': 'Open <b>chrome://extensions</b> (Edge: edge://extensions) and click <b>⟳ Reload</b> on the TradeLingo card.',
  'opt.phrases.hint': 'Type <b>/</b> plus a keyword (such as <b>/quote</b>) in the WhatsApp message box and press Enter; the phrase is translated into the current customer\'s language and put in the message box. Format: one "keyword | text" per line; \\n inside the text means a line break. Replace the sample lead times, payment terms and certificates with your company\'s own.'
};

// 英文界面的示例快捷话术（新装、选择英文界面时使用）
var TL_PHRASES_EN = [
  'hello | Hello! Thank you for your inquiry. How can I help you?',
  'needs | Could you tell me the model, specifications (current, voltage, poles) and quantity you need? I\'ll send you a quotation right away.',
  'quote | Please find our quotation attached. It is valid for 7 days.',
  'leadtime | Standard models are in stock and ship in 3–5 days; custom products take about 15–20 days.',
  'payment | We accept T/T: 30% deposit, with the 70% balance paid before shipment.',
  'sample | We can send samples for testing, and the sample fee is refunded when you place an order.',
  'cert | Our products are CE and CB certified, and we can provide the certificates.',
  'catalog | Here is our latest product catalog. Let me know which models interest you.',
  'followup | Hello, just following up on our quotation. Do you have any questions or anything you\'d like us to adjust?',
  'thanks | Thank you for your order! We\'ll arrange production right away and keep you updated.'
].join('\n');
