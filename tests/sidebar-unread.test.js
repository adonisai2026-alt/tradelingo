const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const now = Date.now();
  await p.addInitScript((now) => {
    const store = { apiKey: 'k:fx', deepseekKey: 'd', wadlDeals: {
      cA: { title: 'Al Noor Electrical', lastIn: now - 2 * 86400000, lastOut: now - 86400000, analyzedAt: now - 86400000, card: { customer: { company: 'Al Noor Electrical' }, heat: { level: '高' } } },
      cB: { title: 'Almaty Energo', lastIn: now - 3 * 86400000, lastOut: now - 2 * 86400000, card: { customer: { company: 'Almaty Energo' } } } } };
    const listeners = []; window.__store = store;
    window.chrome = { i18n: { detectLanguage: (t, cb) => cb({ isReliable: false, languages: [] }) },
      storage: { local: { get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
        set: async (o) => { const ch = {}; for (const k in o) { store[k] = JSON.parse(JSON.stringify(o[k])); ch[k] = { newValue: JSON.parse(JSON.stringify(o[k])) }; } listeners.forEach((f) => f(ch, 'local')); } }, onChanged: { addListener: (f) => listeners.push(f) } },
      runtime: { lastError: null, sendMessage: (m, cb) => cb({ ok: true, engine: 'deepl', note: '', results: (m.texts || []).map((t) => ({ text: t, detected: '' })) }) } };
  }, now);
  await p.goto('file://' + __dirname + '/fixtures/side-wa.html');
  const hhmm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const fiveH = now - 5 * 3600000;
  const sameDay = new Date(fiveH).toDateString() === new Date(now).toDateString();
  await p.evaluate(([t]) => setList([['Al Noor Electrical', t, 3, 'كم السعر؟'], ['Almaty Energo', '昨天', 0, 'ok'], ['朋友 A', '13:00', 5, '晚上吃饭']]), [sameDay ? hhmm(fiveH) : '昨天']);
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  await p.waitForTimeout(800);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  await p.evaluate(() => window.__tradelingoDeal.scanSidebar());
  await p.waitForTimeout(400);
  let st = await p.evaluate(() => window.__store.wadlDeals);
  ok(st.cA.unread === 3, 'Al Noor：读到 3 条未读');
  ok(sameDay ? Math.abs(st.cA.unreadSince - (Math.floor(fiveH / 60000) * 60000)) < 61000 : st.cA.unreadSince > 0, '未读起始时间按列表时间计算' + (sameDay ? `（${hhmm(fiveH)}）` : '（跨天，取下限）'));
  ok(st.cA.lastIn === st.cA.unreadSince && st.cA.lastIn > st.cA.lastOut, '最后收到客户消息时间随之更新 → 变为“客户在等你回复”');
  ok(!st.cB.unread, '没有未读的客户不受影响');
  ok(!Object.values(st).some((r) => r.title === '朋友 A'), '没有作战卡的聊天（如朋友）不处理');
  const info = await p.evaluate(() => window.__tradelingoDeal.sidebarInfo());
  ok(info.found && info.rows === 3 && info.unread === 2 && info.matched === 2, '诊断：识别聊天列表 3 行、2 个有未读、匹配 2 张作战卡');
  // 今日跟进/提醒用到的文案
  const w = await p.evaluate(() => tlWaiting(window.__store.wadlDeals.cA).text);
  ok(/客户有 3 条未读，已等 (5 小时|\d+ 小时|\d+ 天)/.test(w), '往来状态：' + w);
  const sc = await p.evaluate(() => tlScore(window.__store.wadlDeals.cA).reasons.join('；'));
  ok(/客户有 3 条未读/.test(sc), '今日跟进原因：' + sc);
  // 已读后清除
  await p.evaluate(() => setList([['Al Noor Electrical', '14:00', 0, '…'], ['Almaty Energo', '昨天', 0, 'ok']]));
  await p.evaluate(() => window.__tradelingoDeal.scanSidebar());
  await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__store.wadlDeals);
  ok(!st.cA.unread && !st.cA.unreadSince, '在手机或网页上读过后，未读标记清除');
  // 在手机上回复了（列表预览带勾号）
  const t2 = await p.evaluate(() => { const d = new Date(); d.setMinutes(d.getMinutes() - 1); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  await p.evaluate((t) => setList([['Al Noor Electrical', t, 0, '✓ Sure, PI attached'], ['Almaty Energo', '昨天', 0, 'ok']]), t2);
  await p.evaluate(() => window.__tradelingoDeal.scanSidebar());
  await p.waitForTimeout(300);
  st = await p.evaluate(() => window.__store.wadlDeals);
  const w2 = await p.evaluate(() => tlWaiting(window.__store.wadlDeals.cA));
  ok(st.cA.lastOut > st.cA.lastIn && w2.who === 'customer', '在手机上回复后（列表有勾号）：变为“等待客户回复”，提醒解除');
  // 时间解析
  const y = await p.evaluate(() => { const D = window.__tradelingoDeal; const n = Date.now(); const d0 = new Date(n); d0.setHours(0, 0, 0, 0); return [D.listTimeTs('昨天', n) === d0.getTime() - 1, D.listTimeTs('Yesterday', n) > 0, D.listTimeTs('2026/10/12', n) > 0, D.listTimeTs('星期二', n) === 0]; });
  ok(y.every(Boolean), '列表时间解析：昨天 / Yesterday / 日期 / 星期（无法确定时用首次发现时间）');
  // 诊断信息
  const diag = await p.evaluate(async () => { const orig = navigator.clipboard.writeText; let txt = ''; navigator.clipboard.writeText = async (t) => { txt = t; }; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', code: 'KeyD', altKey: true, shiftKey: true, bubbles: true })); await new Promise((r) => setTimeout(r, 300)); return txt; });
  ok(/聊天列表=已识别/.test(diag), '诊断信息包含聊天列表识别结果');
  console.log('errors', errs);
  await b.close();
})();
