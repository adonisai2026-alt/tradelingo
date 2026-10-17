const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const H = /[一-鿿]/;
const mock = (init) => {
  const store = init; const ls = []; window.__store = store; window.__reqs = []; window.__tabs = [];
  window.chrome = {
    i18n: { detectLanguage: (t, cb) => cb({ isReliable: true, languages: [{ language: /[؀-ۿ]/.test(t) ? 'ar' : 'en' }] }) },
    storage: { local: {
      get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
      set: async (o) => { const ch = {}; for (const k in o) { store[k] = JSON.parse(JSON.stringify(o[k])); ch[k] = { newValue: JSON.parse(JSON.stringify(o[k])) }; } ls.forEach((f) => f(ch, 'local')); } },
      onChanged: { addListener: (f) => ls.push(f) } },
    tabs: { create: (o) => window.__tabs.push(o.url) },
    runtime: { lastError: null, getManifest: () => ({ version: '0.9.0' }), getURL: (x) => x, sendMessage: (m, cb) => {
      cb = cb || (() => {});
      window.__reqs.push(JSON.parse(JSON.stringify(m)));
      if (m.type === 'deal') { setTimeout(() => cb({ ok: true, card: { customer: { name: 'Ahmed', company: 'Al Noor Electrical', country: 'Dubai, UAE', type: '分销商' }, heat: { level: '高', reason: 'Asked for the PI and payment terms', src: [] }, stage: '谈判', value: { amount: 7000, currency: 'USD', basis: '200 × $35' }, needs: [{ item: 'MCCB 250A 3P', qty: '200', target: '$35', src: [] }], terms: 'CIF Jebel Ali', blockers: [{ text: 'Competitor offers $36', src: [] }], next: { owner: '我方', action: 'Send the PI today', due: '2020-01-01', draft_zh: 'Hello Ahmed, please find the PI attached.', src: [] }, commitments: [{ who: '我方', what: 'Send PI', date: '01-01', due: '2020-01-01', src: [] }], quotes: [{ date: '01-01', who: '客户', price: '$34', item: '', src: [] }], missing: [{ field: 'Breaking capacity', ask_zh: 'What breaking capacity do you need?' }], summary: ['Needs 200 MCCBs'] } }), 50); return; }
      if (m.type === 'checkUpdate') { setTimeout(() => cb({ ok: true, info: { latest: '0.9.0', hasNew: false, checkedAt: Date.now() } }), 20); return; }
      if (m.texts) { setTimeout(() => cb({ ok: m.target !== 'FAIL', error: 'DeepL timed out', engine: 'deepl', note: '', results: m.texts.map((t) => ({ text: '[' + m.target + '] ' + t, detected: 'AR' })) }), 30); return; }
      cb({ ok: true });
    } }
  };
};
async function hanLeft(p, sel) {
  return p.evaluate((sel) => {
    const out = [];
    const root = document.querySelector(sel) || document.body;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; const e = n.parentElement;
      if (!e || e.closest('textarea, script, style, #msgs, header, [data-keep]')) continue;
      if (e.tagName === 'OPTION' && /中文|界面语言/.test(n.nodeValue)) continue;
      const cs = getComputedStyle(e); if (cs.display === 'none' || e.closest('[hidden]')) continue;
      if (/[一-鿿]/.test(n.nodeValue) && !/^(界面语言 \/ Language|中文)$/.test(n.nodeValue.trim())) out.push(n.nodeValue.trim().slice(0, 40));
    }
    root.querySelectorAll('[title],[placeholder]').forEach((e) => ['title', 'placeholder'].forEach((a) => { const v = e.getAttribute(a); if (v && /[一-鿿]/.test(v) && !e.closest('#msgs')) out.push(a + ':' + v.slice(0, 40)); }));
    return out;
  }, sel);
}
(async () => {
  const b = await chromium.launch();
  const errs = [];
  // ---------- WhatsApp 页面：英文界面 ----------
  const p = await b.newPage({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(mock, { apiKey: 'k:fx', qwenKey: 'q', deepseekKey: 'd', uiLang: 'en', incomingTarget: 'EN-US', outgoingTarget: 'EN-US', wadlDeals: {} });
  await p.goto('file://' + __dirname + '/fixtures/deal-wa.html');
  await p.evaluate(() => {
    addMsg(0, '2026/10/14', '09:30', 'السلام عليكم، نحتاج قواطع MCCB بقدرة 250 أمبير');
    addMsg(1, '2026/10/14', '09:40', 'Sure, what is your target price?');
    addMsg(0, '2026/10/14', '10:02', 'السعر المستهدف 35 دولارًا');
  });
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  await p.waitForTimeout(1500);
  const barTxt = await p.textContent('#wadl-bar');
  ok(/Translate/.test(barTxt) && /Phrases/.test(barTxt) && /Deal/.test(barTxt) && !H.test(barTxt.replace(/中文/g, '')), '工具条：英文（Translate / Phrases / Deal）');
  ok(await p.$eval('#wadl-bar select', (s) => [...s.options].some((o) => o.textContent === 'Arabic') && [...s.options].some((o) => o.textContent === 'Bengali (AI)')), '语言下拉框：英文语言名，AI 语言标“(AI)”');
  ok(/\[EN-US\]/.test(await p.textContent('#msgs')), '收到的消息译成用户自己的语言（英语）');
  await p.click('#wadl-bar .wadl-deal-btn'); await p.waitForTimeout(200);
  ok(/Create deal card/.test(await p.textContent('#tl-deal')), '作战卡面板：英文按钮');
  await p.click('#tl-deal .tl-primary'); await p.waitForTimeout(500);
  const dealReq = await p.evaluate(() => window.__reqs.find((r) => r.type === 'deal'));
  ok(dealReq && dealReq.lang === 'en' && dealReq.messages[0].who === '客户', '分析请求带上 lang=en，发送方标记仍是内部值');
  const card = await p.textContent('#tl-deal');
  ok(/🔥 High/.test(card) && /Negotiation/.test(card) && /Us: Send the PI today/.test(card) && /overdue/.test(card) && /Distributor/.test(card), '作战卡：热度/阶段/我方/客户类型显示为英文，逾期标记正常');
  const left = await hanLeft(p, '#tl-deal');
  ok(left.length === 0, '作战卡面板里没有残留中文' + (left.length ? '：' + left.join(' | ') : ''));
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'en-deal.png') });
  // 切回中文：立即生效
  await p.evaluate(() => chrome.storage.local.set({ uiLang: 'zh' })); await p.waitForTimeout(300);
  ok(/译/.test(await p.textContent('#wadl-bar')), '设置改成中文后，工具条立即变回中文');

  // ---------- 改版预警 ----------
  const q = await b.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
  q.on('pageerror', (e) => errs.push(e.message));
  await q.addInitScript(mock, { apiKey: 'k:fx', wadlDeals: {} });
  await q.goto('file://' + __dirname + '/fixtures/deal-wa.html');
  await q.evaluate(() => { for (let i = 0; i < 5; i++) addMsg(i % 2, '2026/10/14', '09:3' + i, 'Hello, this is a fairly long test message number ' + i); });
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await q.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await q.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  await q.waitForTimeout(16500);
  ok(!(await q.isVisible('#tl-health')), '正常页面：16 秒内不报警');
  // 模拟 WhatsApp 改版：消息不再带 data-pre-plain-text / data-id，正文类名也变了
  await q.evaluate(() => {
    document.querySelectorAll('[data-pre-plain-text]').forEach((e) => e.removeAttribute('data-pre-plain-text'));
    document.querySelectorAll('[data-id]').forEach((e) => e.removeAttribute('data-id'));
    document.querySelectorAll('.selectable-text').forEach((e) => e.classList.remove('selectable-text'));
    document.querySelectorAll('span[dir]').forEach((e) => e.removeAttribute('dir'));
  });
  await q.waitForTimeout(6000);
  ok(!(await q.isVisible('#tl-health')), '刚出问题时先不提示（需要连续确认）');
  await q.waitForTimeout(11000);
  ok(await q.isVisible('#tl-health') && /聊天消息/.test(await q.textContent('#tl-health')), '连续约 15 秒认不出消息：显示改版提示');
  const st = await q.evaluate(() => window.__store.wadlHealth);
  ok(st && st.ok === false && st.problems.includes('messages'), '记录问题（wadlHealth）');
  ok(await q.evaluate(() => window.__reqs.some((r) => r.type === 'checkUpdate')), '出问题时自动在后台检查一次新版本');
  await q.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'health.png') });
  await q.click('#tl-health .tl-h-primary'); await q.waitForTimeout(200);
  ok(/暂时没有新版本/.test(await q.textContent('#tl-health')), '点“检查插件更新”：没有新版时给出下一步');
  await q.click('#tl-health .tl-h-x');
  ok(!(await q.isVisible('#tl-health')), '可以关闭提示');
  await q.waitForTimeout(6000);
  ok(!(await q.isVisible('#tl-health')), '关闭后本次不再弹出');

  // 空聊天（没有消息）不报警
  const e2 = await b.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
  await e2.addInitScript(mock, { apiKey: 'k:fx' });
  await e2.goto('file://' + __dirname + '/fixtures/deal-wa.html');
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await e2.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await e2.waitForTimeout(16500);
  ok(!(await e2.isVisible('#tl-health')), '空聊天（没有消息）不误报');

  // ---------- 设置页 / 今日跟进 / 向导：英文 ----------
  const deals = { a: { title: 'Al Noor', card: { customer: { company: 'Al Noor', country: 'UAE', type: '分销商' }, heat: { level: '高' }, stage: '谈判', value: { amount: 7000, currency: 'USD' }, next: { owner: '我方', action: 'Send PI', due: '2020-01-01' }, commitments: [{ who: '我方', what: 'Send PI', due: '2020-01-01' }], quotes: [], missing: [] }, lastIn: Date.now() - 7200e3, lastOut: Date.now() - 9000e3, analyzedAt: Date.now() },
    b: { title: 'Dhaka', card: { customer: { company: 'Dhaka Power' }, heat: { level: '中' }, stage: '询盘', value: null, next: null, commitments: [], quotes: [], missing: [] }, analyzedAt: Date.now() } };
  for (const [page, sel] of [['options.html', 'body'], ['deals.html', 'body'], ['welcome.html', 'body']]) {
    const o = await b.newPage({ locale: 'en-US', viewport: { width: 900, height: 1000 } });
    o.on('pageerror', (e) => errs.push(page + ': ' + e.message));
    await o.addInitScript(mock, { uiLang: 'en', qwenKey: 'sk-x', wadlDeals: deals, wadlUsage: { month: new Date().toISOString().slice(0, 7), qwen: 100 } });
    await o.goto('file://' + dir + page); await o.waitForTimeout(400);
    if (page === 'welcome.html') { for (const s of ['#to2', '#to3', '#to4']) { await o.evaluate((s) => { const b = document.querySelector(s); b.disabled = false; b.click(); }, s); await o.waitForTimeout(150); } }
    const left2 = await hanLeft(o, sel);
    ok(left2.length === 0, `${page}：英文界面没有残留中文` + (left2.length ? '：' + left2.slice(0, 8).join(' | ') : ''));
    if (page === 'deals.html') {
      ok(/Negotiation 1/.test(await o.textContent('#filters')) && /Our promise overdue/.test(await o.textContent('#list')), '今日跟进：英文阶段筛选和原因');
      await o.click('#filters button:nth-child(5)'); await o.waitForTimeout(100);
      ok((await o.$$('#list li')).length === 1, '英文界面下按阶段筛选仍然正确');
    }
    if (page === 'welcome.html') {
      const s = await o.evaluate(() => window.__store);
      ok(s.uiLang === 'en' && /leadtime \|/.test(s.phrases || ''), '向导（英文）：保存界面语言，示例话术换成英文');
    }
    await o.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'en-' + page.replace('.html', '.png')), fullPage: true });
  }
  // 向导默认推荐：英文推荐 DeepL，中文推荐千问
  const w = await b.newPage({ locale: 'en-US' });
  await w.addInitScript(mock, { uiLang: 'en' }); await w.goto('file://' + dir + 'welcome.html'); await w.waitForTimeout(300);
  ok(await w.$eval('#engines .opt.on', (e) => e.dataset.e) === 'deepl', '英文向导默认推荐 DeepL');
  let saved = null;
  await w.exposeFunction('__report', (o) => { saved = o; });
  await w.evaluate(() => { chrome.storage.local.set = async (o) => { await window.__report(o); }; });
  await w.evaluate(() => document.querySelector('#langsw button[data-l=zh]').click()); await w.waitForTimeout(300);
  ok(saved && saved.uiLang === 'zh', '向导右上角切换语言：保存选择');
  const w2 = await b.newPage({ locale: 'en-US' });
  await w2.addInitScript(mock, { uiLang: 'zh' }); await w2.goto('file://' + dir + 'welcome.html'); await w2.waitForTimeout(300);
  ok(await w2.$eval('#engines .opt.on', (e) => e.dataset.e) === 'qwen' && /选一个翻译引擎/.test(await w2.textContent('#s1')), '中文向导（即使浏览器是英文）：推荐通义千问');
  console.log('errors', errs);
  await b.close();
})();
