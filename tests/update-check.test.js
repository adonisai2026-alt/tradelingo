const fs = require('fs'), vm = require('vm'), path = require('path').join(__dirname, '..', 'extension') + '/';
const store = { qwenKey: 'sk-q' };
let listener, installed, alarmFn, clickFn, notes = [], badge = null, tabs = [], fetches = [];
let rawMode = 'ok', cdnMode = 'ok', remote = { version: '0.9.0', date: '2026-11-01', notes: ['新增：A', '修复：B'], download: 'https://evil.example.com/x.zip' };
const chrome = {
  storage: { local: {
    get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
    set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))), remove: async () => {} } },
  runtime: { getManifest: () => ({ version: '0.8.0' }), getURL: (p) => 'ext://' + p, onMessage: { addListener: (f) => (listener = f) }, onInstalled: { addListener: (f) => (installed = f) }, onStartup: { addListener: () => {} } },
  alarms: { get: (n, cb) => cb(null), create() {}, onAlarm: { addListener: (f) => (alarmFn = f) } },
  notifications: { create: (id, o, cb) => { notes.push({ id, ...o }); cb && cb(); }, clear() {}, onClicked: { addListener: (f) => (clickFn = f) } },
  action: { setBadgeText: (o) => (badge = o.text), setBadgeBackgroundColor() {}, setTitle() {} },
  tabs: { create: (o) => tabs.push(o.url) }
};
const resp = (status, obj) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
async function fetch(url, init) {
  fetches.push(url);
  if (url.includes('raw.githubusercontent')) { if (rawMode === 'down') throw new TypeError('Failed to fetch'); if (rawMode === '404') return resp(404, {}); return resp(200, remote); }
  if (url.includes('jsdelivr')) { if (cdnMode === 'down') throw new TypeError('Failed to fetch'); return resp(200, remote); }
  if (url.includes('dashscope')) { const b = JSON.parse(init.body); return resp(200, { choices: [{ message: { content: 'QW:' + b.messages[0].content } }] }); }
  throw new Error('unexpected ' + url);
}
const ctx = { chrome, fetch, AbortSignal, Date, Math, TextDecoder, TextEncoder, console, setTimeout, clearTimeout, JSON, Map, Set, Object, Array, String, Number, Error, Promise, TypeError };
ctx.importScripts = (...f) => f.forEach((x) => vm.runInContext(fs.readFileSync(path + x, 'utf8'), ctx));
vm.createContext(ctx);
chrome.storage.onChanged = chrome.storage.onChanged || { addListener() {} };
vm.runInContext(fs.readFileSync(path + 'background.js', 'utf8'), ctx);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const call = (msg) => new Promise((r) => listener(msg, {}, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  ok(ctx.wadlVerCmp('0.10.0', '0.9.3') === 1 && ctx.wadlVerCmp('0.8.0', '0.8') === 0 && ctx.wadlVerCmp('0.7.1', '0.8.0') === -1, '版本号按数字比较（0.10.0 > 0.9.3）');
  let threw = false; try { ctx.parseUpdate({ version: '<script>' }, '0.8.0'); } catch (e) { threw = true; }
  ok(threw, '格式不对的 update.json 被拒绝');
  const p = ctx.parseUpdate(remote, '0.8.0');
  ok(p.hasNew && p.download.startsWith('https://github.com/adonisai2026-alt/tradelingo'), '下载链接只接受本仓库地址，其他地址回落到默认 ZIP');

  // 首次安装 → 打开向导
  await installed({ reason: 'install' });
  ok(tabs[0] === 'ext://welcome.html', '首次安装自动打开使用向导');
  tabs = [];
  await installed({ reason: 'update' });
  ok(tabs.length === 0, '升级时不再打开向导');
  await sleep(3200);

  // raw 打不开 → 换 jsDelivr
  rawMode = 'down'; fetches = []; notes = [];
  let r = await call({ type: 'checkUpdate' });
  ok(r.ok && r.info.latest === '0.9.0' && fetches.some((u) => u.includes('jsdelivr')), 'GitHub raw 打不开时自动改用 jsDelivr 镜像');
  ok(badge === '新', '有新版本：图标显示红色“新”角标');
  ok(notes.length <= 1, '最多弹一次桌面通知');
  const notifiedCount = notes.filter((n) => n.id === 'upd-0.9.0').length + (store.wadlUpdate.notifiedFor === '0.9.0' ? 0 : 1);
  ok(store.wadlUpdate.notifiedFor === '0.9.0', '记录已通知过的版本');
  notes = [];
  await call({ type: 'checkUpdate' });
  ok(notes.length === 0, '同一个版本不重复通知');

  // 定时检查：20 小时内不重复请求
  fetches = [];
  alarmFn({ name: 'tl-check' }); await sleep(50);
  ok(!fetches.some((u) => u.includes('update.json')), '20 小时内不重复检查（不浪费流量）');
  store.wadlUpdate.checkedAt = Date.now() - 21 * 3600000;
  alarmFn({ name: 'tl-check' }); await sleep(50);
  ok(fetches.some((u) => u.includes('update.json')), '超过 20 小时自动再查一次');

  // 关闭自动检查
  store.updateCheck = false; store.wadlUpdate.checkedAt = 0; fetches = [];
  alarmFn({ name: 'tl-check' }); await sleep(50);
  ok(!fetches.some((u) => u.includes('update.json')) && badge === '', '关闭自动检查后不联网，也不显示角标');
  store.updateCheck = true;

  // 都打不开
  rawMode = 'down'; cdnMode = 'down';
  r = await call({ type: 'checkUpdate' });
  ok(r.ok && /无法连接 GitHub/.test(r.info.error) && r.info.latest === '0.9.0', '网络不通：提示无法连接，保留上次的版本信息');

  // 已是最新
  rawMode = 'ok'; cdnMode = 'ok'; remote = { version: '0.8.0', notes: [] };
  r = await call({ type: 'checkUpdate' });
  ok(!r.info.hasNew && badge === '' && !r.info.error, '已是最新：去掉角标');

  // 通知点击 → 设置页更新说明
  tabs = []; clickFn('upd-0.9.0');
  ok(tabs[0] === 'ext://options.html?page=1#update', '点更新通知打开设置页的更新说明');

  // 本月用量
  store.incomingEngine = 'qwen';
  await call({ type: 'translate', texts: ['hello', 'world!'], target: 'ZH-HANS' });
  await call({ type: 'translate', texts: ['hello'], target: 'ZH-HANS' }); // 缓存命中
  await sleep(1700);
  const m = new Date().toISOString().slice(0, 7);
  ok(store.wadlUsage && store.wadlUsage.qwen === 11 && store.wadlUsage.month.length === 7, '本月用量：只统计实际发送的字符（缓存命中不计）');
  // 跨月：上月数据移到 prev
  store.wadlUsage = { month: '2020-01', qwen: 500, deepl: 20 };
  vm.runInContext('usage = null', ctx);
  await call({ type: 'translate', texts: ['new text'], target: 'ZH-HANS' });
  await sleep(1700);
  ok(store.wadlUsage.month !== '2020-01' && store.wadlUsage.qwen === 8 && store.wadlUsage.prev.qwen === 500, '换月后从 0 开始，上月合计保留');
})();
