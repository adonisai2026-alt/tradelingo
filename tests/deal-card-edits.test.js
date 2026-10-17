const { chromium } = require('playwright');
const fs = require('fs'); const vm = require('vm');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const p2 = (x) => String(x).padStart(2, '0'); const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const TODAY = ymd(new Date()), FRI = ymd(new Date(Date.now() + 2 * 864e5));
const core = () => { const ctx = { navigator: { language: 'zh-CN' } }; vm.createContext(ctx); for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'notion.js']) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx); return ctx; };
const reasons = (rec) => { const c = core(); c.rec = rec; return vm.runInContext('tlUrgency(rec).reasons', c); };
const notion = (rec) => { const c = core(); c.rec = rec; return vm.runInContext('(() => { const sc = notionSchema("zh"); const cols = {}; NOTION_COLS.forEach(([k, n, t]) => cols[sc.names[k]] = t); return notionProps("k", rec, sc.names, cols, "zh").props; })()', c); };
const mock = ([TODAY, FRI, init]) => {
  const store = { apiKey: 'k:fx', deepseekKey: 'd', uiLang: 'zh', wadlDeals: {}, ...init };
  const ls = []; window.__store = store; window.__reqs = []; window.__aiMode = 'obey'; window.confirm = () => true;
  window.chrome = {
    i18n: { detectLanguage: (t, cb) => cb({ languages: [{ language: 'en' }] }) },
    storage: { local: { get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; }, set: async (o) => { const ch = {}; for (const k in o) { store[k] = JSON.parse(JSON.stringify(o[k])); ch[k] = { newValue: JSON.parse(JSON.stringify(o[k])) }; } ls.forEach((f) => f(ch, 'local')); } }, onChanged: { addListener: (f) => ls.push(f) } },
    runtime: { lastError: null, sendMessage: (m, cb) => {
      cb = cb || (() => {}); window.__reqs.push(JSON.parse(JSON.stringify(m)));
      if (m.type === 'deal' && m.mode === 'full') return setTimeout(() => cb({ ok: true, card: {
        customer: { name: 'Ahmed', company: 'Al Noor', country: '迪拜', type: '分销商' }, heat: { level: '高', reason: '要 PI' }, stage: '谈判', value: { amount: 7000, currency: 'USD', basis: '200 × $35' },
        needs: [{ item: 'MCCB 250A 3P', qty: '200', target: '$35', src: [1] }], terms: 'T/T 30/70', blockers: [{ text: '竞品 $36', src: [] }],
        next: { owner: '我方', action: '发 PI', due: TODAY, draft_zh: '您好，附件是 PI', src: [] },
        commitments: [{ who: '我方', what: '今天发 PI', date: '10-17', due: TODAY, src: [2] }], quotes: [{ date: '10-15', who: '我方', item: 'MCCB', price: '$35.5', src: [] }], missing: [], summary: ['x'] } }), 40);
      if (m.type === 'deal') {
        const card = JSON.parse(JSON.stringify(m.card));
        const add = { who: '我方', what: '周五前寄样品', date: '10-17', due: FRI, src: [m.messages[0].id] };
        const cur = card.commitments || [];
        if (window.__aiMode === 'obey') card.commitments = [...cur, add];
        if (window.__aiMode === 'rewrite') card.commitments = [...cur.map((c) => (c.edited ? { who: '我方', what: '今天发 PI', date: c.date, due: c.due, src: [2] } : c)), add];
        if (window.__aiMode === 'drop') card.commitments = [...cur.filter((c) => !c.edited), add];
        return setTimeout(() => cb({ ok: true, card: { ...card, changed: [{ field: 'commitments', reason: '新增寄样品承诺' }] } }), 40);
      }
      if (m.texts) return setTimeout(() => cb({ ok: true, engine: 'deepl', results: m.texts.map((t) => ({ text: t, detected: 'EN' })) }), 20);
      cb({ ok: true });
    } }
  };
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (init, locale) => {
    const p = await b.newPage({ locale: locale || 'zh-CN', viewport: { width: 1280, height: 900 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(mock, [TODAY, FRI, init || {}]);
    await p.goto('file://' + __dirname + '/fixtures/deal-wa.html');
    await p.evaluate(() => { addMsg(0, '2026/10/17', '09:30', 'Hello, we need MCCB 250A 3P, 200 pcs'); addMsg(1, '2026/10/17', '09:40', 'OK, I will send you the PI today'); });
    for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
    await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
    await p.waitForTimeout(700);
    await p.click('#wadl-bar .wadl-deal-btn'); await p.waitForTimeout(150);
    return p;
  };
  const rec = (p) => p.evaluate(() => Object.values(window.__store.wadlDeals)[0]);
  const editSec = async (p, label, fn) => {
    for (const s of await p.$$('#tl-deal .tl-sec')) if ((await s.textContent()).includes(label)) { await (await s.$('.tl-edit')).click(); break; }
    await p.waitForTimeout(100);
    await p.fill('#tl-deal .tl-ta', fn(await p.inputValue('#tl-deal .tl-ta')));
    await p.click('#tl-deal .tl-edit-row .tl-primary'); await p.waitForTimeout(300);
  };
  const newMsgsAndUpdate = async (p, mode) => {
    await p.evaluate((mode) => { window.__aiMode = mode; addMsg(0, '2026/10/17', '10:10', 'Can you send samples first?'); addMsg(1, '2026/10/17', '10:12', 'Sure, samples before Friday.'); }, mode);
    await p.waitForTimeout(2500);
    await p.click('#tl-deal .tl-ops .tl-primary'); await p.waitForTimeout(500);
  };
  const NOTE = '今天发 PI（已和老板确认单价 $35）';

  for (const mode of ['obey', 'rewrite', 'drop']) {
    const p = await open();
    await p.click('#tl-deal .tl-primary'); await p.waitForTimeout(400);
    await editSec(p, '承诺记录', (v) => v.replace('今天发 PI', NOTE));
    let r = await rec(p);
    if (mode === 'obey') {
      ok(Array.isArray(r.card.commitments) && r.card.commitments[0].edited && r.card.commitments[0].what === NOTE && r.card.commitments[0].due === TODAY, '手动修改承诺后：仍是一条条的结构，截止日期保留，标记为“你改过”');
      ok(!(r.locked || []).includes('commitments'), '承诺记录不再整项锁死');
      ok(reasons(r).some((x) => /我方承诺今天到期/.test(x)), '改过的承诺仍会出现在今日跟进 / 提醒里（今天到期）');
      ok(notion(r)['承诺截止'].date && notion(r)['承诺截止'].date.start === TODAY, 'Notion“承诺截止”仍然有日期');
      ok(/✎ 1 条你改过/.test(await p.textContent('#tl-deal')), '面板显示“✎ 1 条你改过”');
    }
    await newMsgsAndUpdate(p, mode);
    const req = (await p.evaluate(() => window.__reqs.filter((x) => x.type === 'deal').pop()));
    if (mode === 'obey') ok(req.card.commitments[0].edited === true && !req.locked.includes('commitments'), '更新时把“你改过”的标记发给 AI，承诺不在锁定列表里');
    const txt = await p.textContent('#tl-deal');
    ok(/AI 更新建议（1）/.test(txt) && /\+ .*周五前寄样品/.test(txt) && /保留你改过的 1 条/.test(txt), `[AI ${mode}] 出现更新建议：+ 周五前寄样品（保留你改过的 1 条）`);
    if (mode === 'obey') await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'edit-sug.png') });
    await p.click('#tl-deal .tl-sug .tl-sug-row .tl-primary'); await p.waitForTimeout(300);
    r = await rec(p);
    const whats = r.card.commitments.map((c) => c.what);
    ok(whats.length === 2 && whats.includes(NOTE) && whats.includes('周五前寄样品') && r.card.commitments.find((c) => c.what === NOTE).edited, `[AI ${mode}] 采纳后：你的修改原样保留，新承诺加进来，没有重复`);
    if (mode === 'obey') {
      ok(reasons(r).some((x) => /今天到期/.test(x)) && notion(r)['承诺截止'].date.start === TODAY, '采纳后提醒和 Notion 日期都正常');
      await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'edit-after.png') });
    }
    await p.close();
  }

  // 下一步、热度提示、截止日期提示
  let p = await open();
  await p.click('#tl-deal .tl-primary'); await p.waitForTimeout(400);
  await editSec(p, '下一步', () => '我方：周五前发正式 PI（10-23 前）');
  let r = await rec(p);
  ok(r.card.next.action === '周五前发正式 PI' && /-10-23$/.test(r.card.next.due) && r.card.next.edited && (r.locked || []).includes('next'), '手动改“下一步”：保留负责方和截止日期（10-23）');
  ok(/把这句写给客户/.test(await p.textContent('#tl-deal')), '改过的下一步可以一键写给客户');
  await editSec(p, '承诺记录', (v) => v + '\n我方：下周五前寄样品');
  ok(/没认出截止日期/.test(await p.textContent('#tl-deal')), '写“下周五前”这种认不出的日期：提示改成具体日期');
  await editSec(p, '承诺记录', (v) => v.replace('下周五前寄样品', '10月24日前寄样品'));
  r = await rec(p);
  ok(r.card.commitments.some((c) => c.what === '10月24日前寄样品' && /-10-24$/.test(c.due)) && !/没认出截止日期/.test(await p.textContent('#tl-deal')), '改成“10月24日前”后识别出日期，提示消失');
  // 原样保存：不算修改
  await editSec(p, '需求', (v) => v);
  r = await rec(p);
  ok(!r.card.needs[0].edited && r.card.needs[0].src && r.card.needs[0].src[0] === 1, '没改动直接保存：不标记“你改过”，依据消息保留');
  // 热度
  await p.click('#tl-deal .tl-kpi-edit .tl-edit'); await p.waitForTimeout(100);
  await p.fill('#tl-deal .tl-ta', '很热！！'); await p.click('#tl-deal .tl-edit-row .tl-primary'); await p.waitForTimeout(300);
  ok(/热度请写“高 \/ 中 \/ 低”/.test(await p.textContent('#tl-deal')), '热度写“很热”：提示请写 高 / 中 / 低');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'edit-hints.png') });
  await p.close();

  // 旧数据自动转换
  const old = { k1: { title: 'Old', card: { customer: { company: 'Old Co' }, heat: { level: '高' }, stage: '谈判', commitments: { manual: '10-17 我方：今天发 PI（已确认 $35）（截止 ' + TODAY + '）\n客户：下周给数量' }, next: { manual: '我方：发 PI（' + TODAY + ' 前）' }, quotes: [], missing: [] }, locked: ['commitments', 'next', 'terms'], analyzedAt: Date.now() } };
  ok(!reasons(old.k1).some((x) => /承诺/.test(x)), '（对照）旧格式：今天到期的承诺不会提醒');
  p = await b.newPage({ locale: 'zh-CN' });
  await p.addInitScript(mock, [TODAY, FRI, { wadlDeals: old }]);
  await p.goto('file://' + __dirname + '/fixtures/deal-wa.html');
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.waitForTimeout(800);
  r = await rec(p);
  ok(Array.isArray(r.card.commitments) && r.card.commitments.length === 2 && r.card.commitments.every((c) => c.edited) && r.card.commitments[0].due === TODAY && r.card.next.action === '发 PI' && r.card.next.due === TODAY, '旧版手动修改的作战卡：自动拆回一条一条，日期识别出来');
  ok(JSON.stringify(r.locked) === JSON.stringify(['next', 'terms']), '旧数据：承诺不再锁死，下一步和条款保持锁定');
  ok(reasons(r).some((x) => /我方承诺今天到期/.test(x)), '转换后：今天到期的承诺恢复提醒');
  await p.close();
  // 后台升级时也转换
  {
    const store = { wadlDeals: JSON.parse(JSON.stringify(old)) }; let inst;
    const chrome = { storage: { local: { get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; }, set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } }, runtime: { getManifest: () => ({ version: '0.10.2' }), getURL: (x) => x, onMessage: { addListener() {} }, onInstalled: { addListener: (f) => (inst = f) }, onStartup: { addListener() {} } }, alarms: { get: (n, cb) => cb(1), create() {}, onAlarm: { addListener() {} } }, notifications: { create() {}, onClicked: { addListener() {} } }, action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} }, tabs: { create() {} } };
    const ctx = { chrome, navigator: { language: 'zh-CN' }, fetch: async () => { throw new Error('x'); }, AbortSignal, Date, Math, console, setTimeout: () => 0, clearTimeout, JSON, Map, Set, Object, Array, String, Number, Error, Promise };
    ctx.importScripts = (...f) => f.forEach((x) => vm.runInContext(fs.readFileSync(dir + x, 'utf8'), ctx)); vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(dir + 'background.js', 'utf8'), ctx);
    await inst({ reason: 'update' });
    ok(Array.isArray(store.wadlDeals.k1.card.commitments) && store.wadlDeals.k1.card.commitments[0].due === TODAY, '插件升级时后台也会转换（不打开 WhatsApp 也能恢复提醒）');
  }
  // Notion：阶段不乱猜
  const n1 = notion({ title: 'X', card: { stage: { manual: '等客户老板拍板, 大概率下单' } } });
  const n2 = notion({ title: 'X', card: { stage: { manual: '谈判' } } });
  ok(n1['阶段'].select.name === '等客户老板拍板  大概率下单' && n2['阶段'].select.name === '谈判', 'Notion 阶段：“大概率下单”原样写入（不再被归成“下单”），“谈判”对应标准选项');
  const n3 = notion({ title: 'X', card: { commitments: [{ who: '我方', what: 'x'.repeat(3000), due: null, edited: true }] } });
  ok(n3['我方承诺'].rich_text[0].text.content.length <= 2000 && n3['承诺截止'].date === null, 'Notion：超长承诺截断，没有日期时留空（不会同步失败）');

  // 英文界面
  p = await open({ uiLang: 'en' }, 'en-US');
  await p.click('#tl-deal .tl-primary'); await p.waitForTimeout(400);
  await editSec(p, 'Promises', (v) => v + '\nUs: send CB cert (due Oct 30)');
  r = await rec(p);
  ok(r.card.commitments.some((c) => c.what === 'send CB cert' && /-10-30$/.test(c.due) && c.who === '我方'), '英文界面：“Us: send CB cert (due Oct 30)”识别出负责方和日期');
  await p.close();
  console.log('errors', errs);
  await b.close();
})();
