// TradeLingo — Notion 同步（单向：作战卡 → Notion 数据库）。在后台 service worker 中运行。
// 只同步作战卡内容，不发送聊天原文和电话号码。请求直接从浏览器发到 api.notion.com，没有中转服务器。
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const NOTION_ORIGIN = 'https://api.notion.com/*';

// 数据库的列：内部键 → [中文列名, 类型]
const NOTION_COLS = [
  ['title', '客户', 'title'],
  ['company', '公司', 'rich_text'],
  ['country', '国家', 'rich_text'],
  ['type', '客户类型', 'select'],
  ['heat', '热度', 'select'],
  ['stage', '阶段', 'select'],
  ['value', '预估金额', 'number'],
  ['next', '下一步', 'rich_text'],
  ['nextDue', '下一步截止', 'date'],
  ['promises', '我方承诺', 'rich_text'],
  ['promiseDue', '承诺截止', 'date'],
  ['status', '往来状态', 'rich_text'],
  ['lastIn', '客户最后消息', 'date'],
  ['lastOut', '我方最后回复', 'date'],
  ['priority', '优先级', 'number'],
  ['needs', '需求', 'rich_text'],
  ['terms', '条款', 'rich_text'],
  ['blockers', '卡点', 'rich_text'],
  ['quotes', '报价记录', 'rich_text'],
  ['missing', '缺失信息', 'rich_text'],
  ['summary', '摘要', 'rich_text'],
  ['updated', '分析时间', 'date'],
  ['tlid', 'TradeLingo ID', 'rich_text']
];
const NOTION_SELECTS = {
  heat: [['高', 'red'], ['中', 'yellow'], ['低', 'gray']],
  stage: [['询盘', 'gray'], ['报价', 'blue'], ['样品', 'purple'], ['谈判', 'orange'], ['下单', 'green'], ['售后', 'brown']],
  type: [['分销商', 'blue'], ['工程商', 'purple'], ['终端用户', 'green'], ['贸易商', 'orange'], ['未知', 'default']]
};

// 用指定语言执行（数据库建好后列名和选项固定为当时的语言，不随界面语言变化）
function tlWithLang(lang, fn) {
  const old = TL_LANG;
  TL_LANG = lang === 'en' ? 'en' : 'zh';
  try { return fn(); } finally { TL_LANG = old; }
}

// 建库用的列定义 + 列名对照表
function notionSchema(lang) {
  return tlWithLang(lang, () => {
    const names = {};
    const properties = {};
    for (const [key, zh, type] of NOTION_COLS) {
      const name = key === 'tlid' ? 'TradeLingo ID' : tr(zh);
      names[key] = name;
      if (type === 'select') properties[name] = { select: { options: NOTION_SELECTS[key].map(([v, color]) => ({ name: tr(v), color })) } };
      else if (type === 'number') properties[name] = { number: { format: key === 'value' ? 'dollar' : 'number' } };
      else properties[name] = { [type]: {} };
    }
    return { names, properties, title: tr('TradeLingo 商机') };
  });
}

const NOTION_TEXT_MAX = 1900;
const rt = (s) => {
  s = String(s || '').slice(0, NOTION_TEXT_MAX);
  return s ? [{ type: 'text', text: { content: s } }] : [];
};
const dateOnly = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
const dateTime = (ms) => (ms ? new Date(ms).toISOString() : null);

// 一条作战卡 → Notion 属性（纯函数，便于测试）。cols：数据库里实际存在的列 { 列名: 类型 }
function notionProps(key, rec, names, cols, lang, now) {
  return tlWithLang(lang, () => {
    now = now || Date.now();
    const card = rec.card || {};
    const cust = card.customer && !tlIsManual(card.customer) ? card.customer : {};
    const ours = tlIsManual(card.commitments) ? [] : tlArr(card.commitments).filter((c) => c.who === '我方');
    const open = ours.filter((c) => dateOnly(c.due)).map((c) => c.due).sort();
    const nx = card.next && !tlIsManual(card.next) ? card.next : null;
    const w = tlWaiting(rec, now);
    const heat = tlHeatLevel(card.heat);
    const stageRaw = tlIsManual(card.stage) ? card.stage.manual : tlStr(card.stage);
    // 只有完全等于标准阶段（中文或英文）才对应到标准选项；其他写法原样写入，不去猜
    const STAGES = ['询盘', '报价', '样品', '谈判', '下单', '售后'];
    const raw = stageRaw.trim();
    const stage = STAGES.find((x) => raw === x || (TL_EN[x] && raw.toLowerCase() === TL_EN[x].toLowerCase())) || '';
    const amount = tlAmount(card.value);
    const vals = {
      title: tlDealTitle(rec),
      company: cust.company || '',
      country: cust.country || '',
      type: cust.type ? tr(cust.type) : '',
      heat: heat ? tr(heat) : '',
      stage: stage ? tr(stage) : stageRaw,
      value: amount > 0 ? Math.round(amount) : null,
      next: tlFieldText('next', card.next),
      nextDue: nx && nx.owner === '我方' ? dateOnly(nx.due) : null,
      promises: ours.map((c) => (c.what || '') + (c.due ? tr('（截止 {x}）', { x: c.due }) : '')).join('\n') || (tlIsManual(card.commitments) ? card.commitments.manual : ''),
      promiseDue: open[0] || null,
      status: w ? w.text : '',
      lastIn: dateTime(rec.lastIn),
      lastOut: dateTime(rec.lastOut),
      priority: Math.round(tlScore(rec, now).score * 10) / 10,
      needs: tlFieldText('needs', card.needs),
      terms: tlFieldText('terms', card.terms),
      blockers: tlFieldText('blockers', card.blockers),
      quotes: tlFieldText('quotes', card.quotes),
      missing: tlFieldText('missing', card.missing),
      summary: tlFieldText('summary', card.summary),
      updated: dateTime(rec.analyzedAt),
      tlid: key
    };
    const props = {};
    const skipped = [];
    for (const [k, , type] of NOTION_COLS) {
      const name = names[k];
      if (!name || cols[name] !== type) { skipped.push(name || k); continue; }
      const v = vals[k];
      if (type === 'title') props[name] = { title: rt(v || tr('未命名客户')) };
      else if (type === 'rich_text') props[name] = { rich_text: rt(v) };
      else if (type === 'number') props[name] = { number: typeof v === 'number' && isFinite(v) ? v : null };
      else if (type === 'select') props[name] = { select: v ? { name: String(v).replace(/,/g, ' ').slice(0, 90) } : null };
      else if (type === 'date') props[name] = { date: v ? { start: v } : null };
    }
    return { props, skipped };
  });
}

// ---------- 请求 ----------
function notionErr(status, body) {
  let code = '';
  let msg = '';
  try { const j = JSON.parse(body); code = j.code || ''; msg = j.message || ''; } catch (e) { /* 非 JSON */ }
  if (status === -1) return tr('Notion 响应超时');
  if (status === 0) return tr('网络错误，无法连接 Notion');
  if (status === 401 || code === 'unauthorized') return tr('Notion 密钥无效，请重新复制');
  if (status === 403 || code === 'restricted_resource') return tr('这个连接没有权限：请在 Notion 连接设置的“内容访问权限”里添加页面，并勾选读取、更新、插入内容');
  if (status === 404 || code === 'object_not_found') return tr('找不到页面或数据库：请确认已在 Notion 里把它授权给 Tradelingo 连接');
  if (status === 429) return tr('Notion 请求过于频繁，请稍后再试');
  if (status === 400 || code === 'validation_error') return tr('Notion 拒绝了数据：{x}', { x: String(msg).slice(0, 160) });
  return tr('Notion 返回错误 {s}', { s: status });
}

async function notionFetch(token, path, method, body) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(NOTION_API + path, {
        method: method || 'GET',
        headers: { Authorization: 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000)
      });
    } catch (e) {
      if (e && e.message && /permission|Failed to fetch/i.test(e.message) && !(await notionHasPermission())) throw new Error(tr('还没有允许插件访问 Notion：请在设置页点“连接 Notion”并允许'));
      throw new Error(notionErr(e && e.name === 'TimeoutError' ? -1 : 0, ''));
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const ra = Number(res.headers && res.headers.get && res.headers.get('Retry-After')) || attempt + 1;
      await new Promise((r) => setTimeout(r, Math.min(10, ra) * 1000));
      continue;
    }
    const text = await res.text().catch(() => '');
    if (!res.ok) { const err = new Error(notionErr(res.status, text)); err.status = res.status; throw err; }
    try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
  }
}

function notionHasPermission() {
  return new Promise((resolve) => {
    try { chrome.permissions.contains({ origins: [NOTION_ORIGIN] }, (ok) => resolve(!!ok)); } catch (e) { resolve(true); }
  });
}

const plainTitle = (arr) => (Array.isArray(arr) ? arr.map((t) => t.plain_text || (t.text && t.text.content) || '').join('') : '');

// 连接测试：列出授权给这个连接的页面和数据库
async function notionList(token) {
  const r = await notionFetch(token, '/search', 'POST', { page_size: 50, sort: { direction: 'descending', timestamp: 'last_edited_time' } });
  const pages = [];
  const dbs = [];
  for (const o of r.results || []) {
    if (o.archived || o.in_trash) continue;
    if (o.object === 'database') {
      const cols = Object.keys(o.properties || {});
      dbs.push({ id: o.id, title: plainTitle(o.title) || tr('未命名数据库'), url: o.url, ours: cols.includes('TradeLingo ID') });
    } else if (o.object === 'page' && o.parent && o.parent.type !== 'database_id') {
      const tp = Object.values(o.properties || {}).find((p) => p.type === 'title');
      pages.push({ id: o.id, title: (tp && plainTitle(tp.title)) || tr('未命名页面'), url: o.url });
    }
  }
  return { pages, dbs };
}

async function notionCreateDb(token, pageId, lang) {
  const sc = notionSchema(lang);
  const db = await notionFetch(token, '/databases', 'POST', {
    parent: { type: 'page_id', page_id: pageId },
    title: rt(sc.title),
    is_inline: true,
    properties: sc.properties
  });
  return { id: db.id, url: db.url, names: sc.names, lang };
}

// 读取数据库的列，用于检查哪些列还在（用户可以删掉不需要的列，或者改名后插件就跳过它）
async function notionColumns(token, dbId) {
  const db = await notionFetch(token, '/databases/' + dbId);
  const cols = {};
  for (const [name, p] of Object.entries(db.properties || {})) cols[name] = p.type;
  return { cols, url: db.url, title: plainTitle(db.title) };
}

async function notionFindPage(token, dbId, idName, key) {
  const r = await notionFetch(token, '/databases/' + dbId + '/query', 'POST', { filter: { property: idName, rich_text: { equals: key } }, page_size: 1 });
  const p = (r.results || [])[0];
  return p ? { id: p.id, url: p.url } : null;
}

// 同步一条：已知页面就更新，页面被删除或找不到就重新查找 / 新建
async function notionUpsert(token, cfg, cols, key, rec, known) {
  const { props, skipped } = notionProps(key, rec, cfg.names, cols, cfg.lang);
  let page = known && known.page ? { id: known.page, url: known.url } : null;
  if (page) {
    try {
      const r = await notionFetch(token, '/pages/' + page.id, 'PATCH', { properties: props, archived: false });
      return { page: r.id || page.id, url: r.url || page.url, skipped };
    } catch (e) {
      if (e.status !== 404 && e.status !== 400) throw e;
      page = null; // 页面被删除：重新查找或新建
    }
  }
  if (cols[cfg.names.tlid] === 'rich_text') page = await notionFindPage(token, cfg.db, cfg.names.tlid, key);
  if (page) {
    try {
      const r = await notionFetch(token, '/pages/' + page.id, 'PATCH', { properties: props });
      return { page: r.id || page.id, url: r.url || page.url, skipped };
    } catch (e) {
      if (e.status !== 404) throw e; // 查到的页面在回收站里：新建一页
    }
  }
  const r = await notionFetch(token, '/pages', 'POST', { parent: { database_id: cfg.db }, properties: props });
  return { page: r.id, url: r.url, skipped };
}

// 判断一条是否需要重新同步：属性内容变了才发请求
function notionHash(key, rec, cfg) {
  const cols = {};
  for (const [k, , type] of NOTION_COLS) cols[cfg.names[k]] = type;
  const { props } = notionProps(key, rec, cfg.names, cols, cfg.lang, Math.floor(Date.now() / 3600000) * 3600000);
  const s = JSON.stringify(props);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
