const fs = require('fs'), vm = require('vm'), path = require('path').join(__dirname, '..', 'extension') + '/';
const store = {}; const created = []; let alarmCreated = null;
const chrome = {
  storage: { local: { get: async (d) => { if (d === null) return { ...store }; const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; }, set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))), remove: async () => {} } },
  runtime: { onMessage: { addListener: (f) => (chrome._msg = f) }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, getURL: (p) => 'chrome-extension://x/' + p, lastError: null },
  alarms: { get: (n, cb) => cb(null), create: (n, o) => (alarmCreated = [n, o]), onAlarm: { addListener() {} } },
  notifications: { create: (id, o, cb) => { created.push({ id, ...o }); cb && cb(id); }, onClicked: { addListener() {} }, clear() {} },
  tabs: { create: async () => {} }
};
const ctx = { chrome, fetch: async () => ({}), console, setTimeout, clearTimeout, AbortSignal, AbortController, TextDecoder, TextEncoder, ReadableStream, Date, Math, JSON, Map, Set, Object, Array, String, Number, Error, Promise, Intl };
ctx.importScripts = (...fs2) => fs2.forEach((f) => vm.runInContext(fs.readFileSync(path + f, 'utf8'), ctx));
vm.createContext(ctx);
chrome.storage.onChanged = chrome.storage.onChanged || { addListener() {} };
vm.runInContext(fs.readFileSync(path + 'background.js', 'utf8'), ctx);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const call = (msg) => new Promise((r) => chrome._msg(msg, {}, r));
(async () => {
  ok(alarmCreated && alarmCreated[0] === 'tl-check' && alarmCreated[1].periodInMinutes === 15, '注册每 15 分钟检查一次的定时器');
  const at = (h) => { const d = new Date(); d.setHours(h, 30, 0, 0); return d.getTime(); };
  const today = vm.runInContext('tlTodayStr()', ctx);
  const yest = vm.runInContext(`tlTodayStr(new Date(Date.now() - 86400000))`, ctx);
  const now = at(10);
  const deals = {
    a: { title: 'Al Noor', lastIn: now - 6 * 3600000, lastOut: now - 8 * 3600000, card: { customer: { company: 'Al Noor' }, heat: { level: '高' }, value: { amount: 7000 },
      commitments: [{ who: '我方', what: '发 PI', due: today }, { who: '客户', what: '给数量', due: today }], next: { owner: '我方', action: '回应竞品价', due: yest } } },
    b: { title: 'Almaty', lastIn: now - 2 * 3600000, lastOut: now - 3 * 3600000, card: { customer: { company: 'Almaty Energo' }, heat: { level: '中' } } },
    c: { title: 'Dhaka', lastIn: now - 9 * 86400000, lastOut: now - 2 * 86400000, card: { customer: { company: 'Dhaka Power' } } }
  };
  const s = { notifyEnabled: true, notifyWaitHours: 4, digestEnabled: true, digestHour: 9 };
  const plan = (n, set, t) => JSON.parse(JSON.stringify(vm.runInContext('planReminders', ctx)(deals, set || s, n, t || now)));
  let r = plan({});
  const titles = r.list.map((x) => x.title);
  ok(titles[0].startsWith('今日跟进：') && /Al Noor/.test(r.list[0].message.split('\n')[0]), '早报：排在第一的是 Al Noor → ' + titles[0]);
  ok(titles.includes('承诺今天到期：Al Noor') && !titles.some((t) => /给数量/.test(t)), '我方承诺今天到期才提醒（客户的承诺不提醒）');
  ok(titles.includes('下一步已逾期：Al Noor'), '下一步已逾期提醒');
  ok(titles.includes('客户在等你回复：Al Noor') && !titles.includes('客户在等你回复：Almaty Energo'), '客户等待 ≥4 小时才提醒（2 小时的不提醒）');
  ok(!titles.some((t) => /Dhaka/.test(t) && /等你回复/.test(t)), '我方最后发言（等客户回复）不弹提醒');
  const r2 = plan(r.marks);
  ok(r2.list.length === 0, '同一天再次检查：不重复提醒');
  ok(plan({}, s, at(8)).list.every((x) => !x.title.startsWith('今日跟进')), '早报不会在 9 点前发送');
  ok(plan({}, { ...s, notifyEnabled: false }).list.length === 1, '关闭桌面提醒后只剩早报');
  // 超过 4 条合并
  const many = {}; for (let i = 0; i < 7; i++) many['x' + i] = { title: 'C' + i, lastIn: now - 5 * 3600000, lastOut: 0, card: {} };
  const rm = JSON.parse(JSON.stringify(vm.runInContext('planReminders', ctx)(many, { ...s, digestEnabled: false }, {}, now)));
  ok(rm.list.length === 4 && /还有 4 条/.test(rm.list[3].title), '一次最多弹 4 条，其余合并：' + rm.list[3].title);
  // 端到端：checkNow 实际发送
  store.wadlDeals = deals; Object.assign(store, s);
  const res = await call({ type: 'checkNow' });
  ok(res.ok && created.length >= 3 && created.every((n) => n.iconUrl === 'icons/icon128.png'), `立即检查：实际弹出 ${created.length} 条通知`);
  ok(store.wadlNotified && Object.keys(store.wadlNotified).length >= 3, '记录已提醒事项，用于去重');
  const t = await call({ type: 'testNotify' });
  ok(t.ok && created.some((n) => n.title === 'TradeLingo 测试通知'), '测试通知');
  // 备份合并
  const merge = vm.runInContext('tlMergeBackup', ctx);
  const cur = { wadlDeals: { a: { card: {}, analyzedAt: 100 }, b: { card: {}, analyzedAt: 500 } }, wadlChatLangs: { a: { l: 'AR', m: true, t: 1 }, b: { l: 'EN-US', m: false, t: 1 } } };
  const bk = { app: 'TradeLingo', settings: { phrases: 'x | y', apiKey: '', deepseekKey: 'sk-new', bogus: 1 }, deals: { a: { card: { stage: '下单' }, analyzedAt: 300 }, b: { card: {}, analyzedAt: 200 }, c: { card: {}, analyzedAt: 1 }, bad: { x: 1 } },
    chatLangs: { a: { l: 'RU', m: false, t: 9 }, b: { l: 'IT', m: true, t: 0 }, c: { l: 'KK', m: false, t: 5 } } };
  const m = JSON.parse(JSON.stringify(merge(cur, bk)));
  ok(m.dealsAdded === 1 && m.dealsUpdated === 1 && m.patch.wadlDeals.a.card.stage === '下单' && m.patch.wadlDeals.b.analyzedAt === 500, '作战卡合并：新增 1、较新的覆盖 1、较旧的保留');
  ok(m.patch.wadlChatLangs.a.l === 'AR' && m.patch.wadlChatLangs.b.l === 'IT' && m.patch.wadlChatLangs.c.l === 'KK', '语言记录合并：手动指定优先');
  ok(m.patch.deepseekKey === 'sk-new' && !('apiKey' in m.patch) && !('bogus' in m.patch) && m.keys, '设置合并：空 Key 不覆盖、未知字段忽略');
})();
