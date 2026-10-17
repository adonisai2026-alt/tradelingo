const fs = require('fs'), vm = require('vm'), path = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
function setup(storeInit, opts = {}) {
  const store = JSON.parse(JSON.stringify(storeInit));
  const ls = []; let listener;
  const N = { dbs: {}, pages: {}, calls: [], n: 0, badToken: false, perm: opts.perm !== false };
  const chrome = {
    storage: { local: {
      get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
      set: async (o) => { const ch = {}; for (const k in o) { store[k] = JSON.parse(JSON.stringify(o[k])); ch[k] = { newValue: o[k] }; } ls.forEach((f) => f(ch, 'local')); },
      remove: async (ks) => { for (const k of [].concat(ks)) delete store[k]; } },
      onChanged: { addListener: (f) => ls.push(f) } },
    permissions: { contains: (q, cb) => cb(N.perm) },
    runtime: { getManifest: () => ({ version: '0.9.1' }), getURL: (x) => x, onMessage: { addListener: (f) => (listener = f) }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    alarms: { get: (n, cb) => cb(1), create() {}, onAlarm: { addListener() {} } },
    notifications: { create() {}, clear() {}, onClicked: { addListener() {} } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} }, tabs: { create() {} }
  };
  const resp = (status, obj) => ({ ok: status < 300, status, headers: { get: () => null }, text: async () => JSON.stringify(obj) });
  async function fetch(url, init) {
    if (!url.startsWith('https://api.notion.com/v1')) throw new Error('unexpected ' + url);
    if (!N.perm) throw new TypeError('Failed to fetch');
    const h = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : null;
    N.calls.push({ url, method: init.method, body, version: h['Notion-Version'], auth: h.Authorization });
    if (N.badToken || h.Authorization !== 'Bearer ntn_test') return resp(401, { code: 'unauthorized', message: 'API token is invalid.' });
    const p = url.slice('https://api.notion.com/v1'.length);
    const m = init.method;
    if (p === '/search') return resp(200, { results: [
      { object: 'page', id: 'pg1', url: 'https://notion.so/pg1', parent: { type: 'workspace' }, properties: { title: { type: 'title', title: [{ plain_text: 'TradeLingo 商机' }] } } },
      ...Object.values(N.dbs).map((d) => ({ object: 'database', id: d.id, url: d.url, title: d.title, properties: d.properties }))] });
    if (p === '/databases' && m === 'POST') {
      const id = 'db' + ++N.n;
      const props = {};
      for (const [name, def] of Object.entries(body.properties)) props[name] = { type: Object.keys(def)[0], ...def };
      N.dbs[id] = { id, url: 'https://notion.so/' + id, title: body.title, properties: props, parent: body.parent };
      return resp(200, N.dbs[id]);
    }
    let mm;
    if ((mm = p.match(/^\/databases\/(\w+)$/))) { const d = N.dbs[mm[1]]; return d ? resp(200, d) : resp(404, { code: 'object_not_found' }); }
    if ((mm = p.match(/^\/databases\/(\w+)\/query$/))) {
      const f = body.filter;
      const res = Object.values(N.pages).filter((pg) => pg.db === mm[1] && !pg.archived && !pg.deleted && pg.props[f.property] && pg.props[f.property].rich_text.map((t) => t.text.content).join('') === f.rich_text.equals);
      return resp(200, { results: res.map((x) => ({ id: x.id, url: x.url })) });
    }
    const check = (props, db) => { for (const name of Object.keys(props)) if (!N.dbs[db].properties[name]) return 'no column ' + name; for (const v of Object.values(props)) { if (v.rich_text && v.rich_text.some((t) => t.text.content.length > 2000)) return 'too long'; if (v.select && /,/.test(v.select.name)) return 'comma'; } return ''; };
    if (p === '/pages' && m === 'POST') {
      const e = check(body.properties, body.parent.database_id); if (e) return resp(400, { code: 'validation_error', message: e });
      const id = 'p' + ++N.n; N.pages[id] = { id, url: 'https://notion.so/' + id, db: body.parent.database_id, props: body.properties }; return resp(200, N.pages[id]);
    }
    if ((mm = p.match(/^\/pages\/(\w+)$/)) && m === 'PATCH') {
      const pg = N.pages[mm[1]]; if (!pg || pg.deleted) return resp(404, { code: 'object_not_found' });
      const e = check(body.properties, pg.db); if (e) return resp(400, { code: 'validation_error', message: e });
      Object.assign(pg.props, body.properties); return resp(200, pg);
    }
    return resp(400, { message: 'unhandled ' + p });
  }
  const ctx = { chrome, fetch, AbortSignal, Date, Math, TextDecoder, TextEncoder, console, setTimeout, clearTimeout, JSON, Map, Set, Object, Array, String, Number, Error, Promise, TypeError, navigator: { language: opts.lang || 'zh-CN' } };
  ctx.importScripts = (...f) => f.forEach((x) => vm.runInContext(fs.readFileSync(path + x, 'utf8'), ctx));
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path + 'background.js', 'utf8'), ctx);
  const call = (msg) => new Promise((r) => listener(msg, {}, r));
  return { store, N, call, ctx, fire: (o) => chrome.storage.local.set(o) };
}
const deal = (title, extra) => ({ title, card: {
  customer: { name: 'Ahmed', company: title, country: '阿联酋 迪拜', type: '分销商' }, heat: { level: '高', reason: '要 PI' }, stage: '谈判',
  value: { amount: 7100, currency: 'USD', basis: '200 × $35.5' }, needs: [{ item: 'MCCB 250A 3P', qty: '200', target: '$35' }], terms: 'T/T 30%',
  blockers: [{ text: '竞品 $36' }], next: { owner: '我方', action: '发 PI', due: today, draft_zh: '您好' },
  commitments: [{ who: '我方', what: '发 PI', due: today }, { who: '我方', what: '寄样品', due: '2026-12-01' }, { who: '客户', what: '确认数量' }],
  quotes: [{ date: '10-15', who: '我方', price: '$35.5' }], missing: [{ field: '分断能力' }], summary: ['客户要 200 台'] },
  srcMap: { 1: { who: '客户', text: 'SECRET chat text call me +971 00 000 1234' } }, lastIn: Date.now() - 2 * 3600e3, lastOut: Date.now() - 3 * 3600e3, analyzedAt: Date.now(), ...extra });

(async () => {
  const t = setup({ notionToken: 'ntn_test', uiLang: 'zh', wadlDeals: { k1: deal('Al Noor Electrical'), k2: deal('Almaty Energo', { card: { customer: { company: 'Almaty Energo' }, heat: { level: '中' }, stage: '询盘', value: null, summary: ['x'.repeat(5000)] } }) } });
  let r = await t.call({ type: 'notionList', token: 'ntn_test' });
  ok(r.ok && r.pages.length === 1 && r.pages[0].title === 'TradeLingo 商机', '连接：列出授权给连接的页面');
  ok(t.N.calls.every((c) => c.version === '2022-06-28'), '请求带 Notion-Version 头');
  r = await t.call({ type: 'notionCreateDb', pageId: 'pg1' });
  const db = Object.values(t.N.dbs)[0];
  ok(r.ok && db && db.parent.page_id === 'pg1' && Object.keys(db.properties).length === 23, '在所选页面下创建数据库（23 列）');
  ok(db.properties['热度'].select.options.map((o) => o.name).join() === '高,中,低' && db.properties['预估金额'].number.format === 'dollar', '热度选项、金额格式（美元）');
  ok(r.result && r.result.done === 2 && Object.keys(t.N.pages).length === 2, '创建后立即同步 2 个客户');
  const pg = Object.values(t.N.pages).find((p) => p.props['客户'].title[0].text.content === 'Al Noor Electrical');
  const txt = (n) => pg.props[n].rich_text.map((x) => x.text.content).join('');
  ok(pg.props['热度'].select.name === '高' && pg.props['阶段'].select.name === '谈判' && pg.props['预估金额'].number === 7100, '热度、阶段、金额写对');
  ok(pg.props['下一步截止'].date.start === today && pg.props['承诺截止'].date.start === today && /发 PI/.test(txt('我方承诺')) && !/确认数量/.test(txt('我方承诺')), '下一步截止、最近的我方承诺截止；不含客户承诺');
  ok(txt('TradeLingo ID') === 'k1' && /客户在等你回复/.test(txt('往来状态')) && pg.props['优先级'].number > 0, 'TradeLingo ID、往来状态、优先级');
  const all = JSON.stringify(t.N.calls);
  ok(!/SECRET|000 1234|您好/.test(all), '不发送聊天原文、电话号码和草稿');
  const p2 = Object.values(t.N.pages).find((p) => p.props['客户'].title[0].text.content === 'Almaty Energo');
  ok(p2.props['摘要'].rich_text[0].text.content.length <= 2000 && p2.props['预估金额'].number === null, '超长文字截断；金额未知写空');

  // 没有变化 → 不发请求
  let before = t.N.calls.length;
  await t.call({ type: 'notionSyncNow' }).then(() => {});
  const writes = t.N.calls.slice(before).filter((c) => /\/pages/.test(c.url)).length;
  ok(writes === 2, '手动“全部同步”会重写全部（2 条）');
  // 自动同步：改一条作战卡 → 6 秒后只同步这一条
  before = t.N.calls.length;
  const d = JSON.parse(JSON.stringify(t.store.wadlDeals)); d.k1.card.stage = '下单';
  await t.fire({ wadlDeals: d });
  await sleep(7500);
  const w2 = t.N.calls.slice(before).filter((c) => /\/pages/.test(c.url));
  ok(w2.length === 1 && w2[0].method === 'PATCH' && pg.props['阶段'].select.name === '下单', '自动同步：只更新改动的那一条（PATCH）');
  // 内容不变的存储变化不触发写入
  before = t.N.calls.length;
  await t.fire({ wadlDeals: JSON.parse(JSON.stringify(t.store.wadlDeals)) });
  await sleep(7000);
  ok(t.N.calls.slice(before).filter((c) => /\/pages/.test(c.url)).length === 0, '内容没变：不重复写 Notion');
  // 用户删掉一列
  delete db.properties['摘要'];
  d.k1.card.heat = { level: '低' };
  await t.fire({ wadlDeals: JSON.parse(JSON.stringify(d)) }); await sleep(7500);
  ok(pg.props['热度'].select.name === '低' && (t.store.wadlNotionSync.skipped || []).includes('摘要') && !t.store.wadlNotionSync.error, '用户删掉“摘要”列：其他列照常同步，并提示跳过');
  // 用户在 Notion 里删了页面 → 重新创建
  pg.deleted = true;
  d.k1.card.stage = '售后';
  await t.fire({ wadlDeals: JSON.parse(JSON.stringify(d)) }); await sleep(7500);
  const fresh = Object.values(t.N.pages).filter((p) => !p.deleted && p.props['TradeLingo ID'].rich_text[0].text.content === 'k1');
  ok(fresh.length === 1 && fresh[0].props['阶段'].select.name === '售后', '页面在 Notion 被删：自动重新创建');
  // 关闭自动同步
  t.store.notionAuto = false; before = t.N.calls.length;
  d.k1.card.stage = '报价';
  await t.fire({ wadlDeals: JSON.parse(JSON.stringify(d)) }); await sleep(7000);
  ok(t.N.calls.length === before, '关闭自动同步：不写 Notion');
  r = await t.call({ type: 'notionSyncNow' });
  ok(r.ok && r.done === 2, '关闭自动后仍可手动同步');
  // 密钥失效
  t.N.badToken = true;
  r = await t.call({ type: 'notionSyncNow' });
  ok(r.ok && /密钥无效/.test(r.error) && /密钥无效/.test(t.store.wadlNotionSync.error), '密钥失效：给出明确提示');
  t.N.badToken = false;
  // 断开
  r = await t.call({ type: 'notionDisconnect' });
  ok(!t.store.wadlNotion && Object.keys(t.N.pages).length >= 2, '断开：不再同步，Notion 数据保留');
  // 重新接入已有数据库
  r = await t.call({ type: 'notionUseDb', dbId: db.id });
  ok(r.ok && t.store.wadlNotion.db === db.id && t.store.wadlNotion.names.heat === '热度', '可以接回已有的 TradeLingo 数据库');

  // 没有授权 api.notion.com
  const u = setup({ notionToken: 'ntn_test', uiLang: 'zh', wadlDeals: {} }, { perm: false });
  r = await u.call({ type: 'notionList', token: 'ntn_test' });
  ok(!r.ok && /还没有允许插件访问 Notion/.test(r.error), '未授权访问 api.notion.com：提示去允许');
  // 错的数据库
  const v = setup({ notionToken: 'ntn_test', uiLang: 'zh', wadlDeals: {} });
  v.N.dbs.x1 = { id: 'x1', url: 'u', title: [], properties: { Name: { type: 'title' } } };
  r = await v.call({ type: 'notionUseDb', dbId: 'x1' });
  ok(!r.ok && /不是 TradeLingo 创建的/.test(r.error), '选了不是 TradeLingo 的数据库：拒绝并说明');

  // 英文界面
  const e = setup({ notionToken: 'ntn_test', uiLang: 'en', wadlDeals: { k1: deal('Al Noor') } }, { lang: 'en-US' });
  r = await e.call({ type: 'notionCreateDb', pageId: 'pg1' });
  const edb = Object.values(e.N.dbs)[0];
  const ep = Object.values(e.N.pages)[0];
  ok(edb.properties['Heat'] && edb.properties['Next step due'] && ep.props['Heat'].select.name === 'High' && ep.props['Stage'].select.name === 'Negotiation' && ep.props['Customer type'].select.name === 'Distributor', '英文界面：英文列名和选项');
  ok(edb.title[0].text.content === 'TradeLingo deals', '英文数据库标题');
  delete e.store.wadlNotion;
  r = await e.call({ type: 'notionUseDb', dbId: edb.id });
  ok(r.ok && e.store.wadlNotion.lang === 'en' && e.store.wadlNotion.names.heat === 'Heat', '接回英文数据库：自动识别英文列名');
  process.exit();
})();
