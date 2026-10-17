const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const store = { apiKey: 'k:fx', qwenKey: 'q', deepseekKey: 'd', backTranslate: true, wadlDeals: {} };
    const listeners = []; window.__store = store; window.__reqs = [];
    const today = new Date(); const p2 = (x) => String(x).padStart(2, '0'); const ymd = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;
    window.chrome = {
      i18n: { detectLanguage: (t, cb) => cb({ isReliable: /[؀-ۿ]/.test(t), languages: /[؀-ۿ]/.test(t) ? [{ language: 'ar' }] : [] }) },
      storage: { local: {
        get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
        set: async (o) => { const ch = {}; for (const k in o) { store[k] = JSON.parse(JSON.stringify(o[k])); ch[k] = { newValue: JSON.parse(JSON.stringify(o[k])) }; } listeners.forEach((f) => f(ch, 'local')); } },
        onChanged: { addListener: (f) => listeners.push(f) } },
      runtime: { lastError: null, sendMessage: (m, cb) => {
        window.__reqs.push(JSON.parse(JSON.stringify(m)));
        if (m.type === 'deal') {
          const card = m.mode === 'full' ? {
            customer: { name: 'Ahmed', company: 'Al Noor Electrical', country: '阿联酋 迪拜', type: '分销商' },
            heat: { level: '高', reason: '主动询问付款方式和交期，回复很快', src: [3, 4] }, stage: '谈判',
            value: { amount: 7000, currency: 'USD', basis: '200 × $35' },
            needs: [{ item: 'MCCB 塑壳断路器 250A 3P', qty: '200', target: '$35', src: [1] }],
            terms: 'CIF 杰贝阿里 · T/T 30/70 · 30 天内交货',
            blockers: [{ text: '价格：客户称另一家报价 $36', src: [5] }, { text: 'CB 证书未确认', src: [] }],
            next: { owner: '我方', action: '发正式 PI，并回应竞品价 $36', due: ymd, draft_zh: '您好 Ahmed，附件是 200 台 250A 3P 塑壳断路器的形式发票，请查收。', src: [5] },
            commitments: [{ who: '我方', what: '周五前发 PI', date: '10-15', due: ymd, src: [6] }, { who: '客户', what: '下周给最终数量', date: '10-14', due: null, src: [2] }],
            quotes: [{ date: '10-12', who: '我方', price: '$38', item: 'MCCB 250A 3P', src: [] }, { date: '10-15', who: '客户', price: '$34', item: '', src: [5] }],
            missing: [{ field: '分断能力', ask_zh: '请问您需要的分断能力是多少 kA？' }, { field: '决策人', ask_zh: '请问最终由谁来确认这个订单？' }],
            summary: ['客户需要 200 台 250A 3P MCCB', '关注价格和交期', '有竞品报价 $36']
          } : { ...m.card, needs: [{ item: 'MCCB 塑壳断路器 250A 3P', qty: '500', target: '$35', src: [m.messages[0].id] }], value: { amount: 17500, currency: 'USD', basis: '500 × $35' }, terms: 'FOB 上海', changed: [{ field: 'needs', reason: '客户把数量改为 500 台' }, { field: 'value', reason: '数量变化' }, { field: 'terms', reason: '客户改为 FOB' }] };
          setTimeout(() => cb({ ok: true, card }), 80); return;
        }
        if (m.type === 'openDeals') { window.__openedDeals = true; cb({ ok: true }); return; }
        setTimeout(() => cb({ ok: true, engine: m.direction === 'outgoing' ? 'qwen' : 'deepl', note: '', results: m.texts.map((t) => m.target.startsWith('ZH') ? { text: ({ 'Hello, we need MCCB 250A 3P, 200 pcs. Call me +971 00 000 0000': '您好，我们需要 250A 3P 的塑壳断路器，200 台。请打我电话 +971 00 000 0000', 'Target $35. What is the payment term and lead time?': '目标价 35 美元。付款方式和交期是怎样的？', 'Another supplier offers $36': '另一家供应商报价 36 美元', 'Please change quantity to 500 pcs, FOB Shanghai': '请把数量改成 500 台，FOB 上海' })[t] || ('【中】' + t), detected: 'EN' } : { text: `[${m.target}] ${t}`, detected: 'ZH' }) }), 30);
      } }
    };
  });
  await p.goto('file://' + __dirname + '/fixtures/deal-wa.html');
  await p.evaluate(() => {
    addMsg(0, '2026/10/14', '09:30', 'Hello, we need MCCB 250A 3P, 200 pcs. Call me +971 00 000 0000');
    addMsg(1, '2026/10/14', '09:40', 'Sure, what is your target price?');
    addMsg(0, '2026/10/14', '10:02', 'Target $35. What is the payment term and lead time?');
    addMsg(0, '2026/10/15', '08:10', 'Another supplier offers $36');
  });
  for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  await p.waitForTimeout(800);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  ok(await p.$('#wadl-bar .wadl-deal-btn') !== null, '工具条出现“单”按钮');
  await p.click('#wadl-bar .wadl-deal-btn');
  await p.waitForTimeout(200);
  ok((await p.textContent('#tl-deal')).includes('生成作战卡'), '面板打开，显示“生成作战卡”');
  await p.click('#tl-deal .tl-primary');
  await p.waitForTimeout(500);
  const req = await p.evaluate(() => window.__reqs.find((r) => r.type === 'deal'));
  ok(req.messages.length === 4 && req.messages[0].who === '客户' && req.messages[1].who === '我方' && req.messages[0].time === '10-14 09:30', '发送 4 条消息，含发送方和时间');
  ok(!/000 0000/.test(JSON.stringify(req)) && /\[号码\]/.test(req.messages[0].text), '电话号码已打码');
  const txt = await p.textContent('#tl-deal');
  ok(/🔥 高/.test(txt) && /谈判/.test(txt) && /≈ \$7,000/.test(txt), '显示热度、阶段、预估金额');
  ok(/今天到期/.test(txt), '我方承诺今天到期被标红');
  ok(/客户在等你回复/.test(txt), '往来状态：客户在等你回复（本地计算）');
  const srcTitle = await p.$eval('#tl-deal .tl-kpi .tl-has-src', (e) => e.title);
  ok(/依据：/.test(srcTitle) && /10-14 10:02 客户/.test(srcTitle), '鼠标悬停显示依据消息：' + srcTitle.split('\n')[1]);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'deal-card.png') });

  // 起草这条消息 → 翻译成当前客户语言（未识别 → 默认英语）填入输入框
  await p.click('#tl-deal .tl-next .tl-primary');
  await p.waitForTimeout(900);
  const inp = await p.textContent('footer [contenteditable]');
  const curLang = await p.evaluate(() => window.__tradelingo.currentTarget().lang);
  ok(inp.startsWith(`[${curLang}] 您好 Ahmed，附件是 200 台`), `起草：翻译成当前客户语言（${curLang}）后填入输入框`);
  const trReq = await p.evaluate(() => window.__reqs.filter((r) => r.type === 'translate' && r.direction === 'outgoing').pop());
  ok(trReq && !trReq.engine, '起草的翻译走现有翻译设置（未强制引擎）');

  // 生成追问
  await p.evaluate(() => { document.querySelector('footer [contenteditable]').innerText = ''; });
  await p.click('#tl-deal .tl-miss .tl-mini');
  await p.waitForTimeout(900);
  ok((await p.textContent('footer [contenteditable]')).includes('分断能力是多少 kA'), '生成追问：填入输入框');

  // 手动修改条款 → 锁定
  const secs = await p.$$('#tl-deal .tl-sec');
  for (const s of secs) { if ((await s.textContent()).startsWith('条款')) { await (await s.$('.tl-edit')).click(); break; } }
  await p.waitForTimeout(100);
  await p.fill('#tl-deal .tl-ta', 'CIF 杰贝阿里 · T/T 30/70（手动确认）');
  await p.click('#tl-deal .tl-edit-row .tl-primary');
  await p.waitForTimeout(400);
  ok(/✎ 已手动/.test(await p.textContent('#tl-deal')) && /手动确认/.test(await p.textContent('#tl-deal')), '手动修改条款后显示“已手动”并锁定');

  // 新消息 → 角标 + 更新按钮
  await p.evaluate(() => addMsg(0, '2026/10/16', '09:00', 'Please change quantity to 500 pcs, FOB Shanghai'));
  await p.waitForTimeout(2600);
  ok(await p.$eval('#wadl-bar .wadl-deal-btn', (e) => e.classList.contains('wadl-has-new')), '有新消息时“单”按钮出现红点（不消耗 Token）');
  ok(/更新（1 条新消息）/.test(await p.textContent('#tl-deal')), '显示“更新（1 条新消息）”');
  await p.click('#tl-deal .tl-ops .tl-primary');
  await p.waitForTimeout(500);
  const upd = await p.evaluate(() => window.__reqs.filter((r) => r.type === 'deal').pop());
  ok(upd.mode === 'update' && upd.messages.length === 1 && upd.messages[0].id === 5 && upd.locked.includes('terms'), '增量更新：只发 1 条新消息（id 接续为 5），并带上锁定字段');
  let t2 = await p.textContent('#tl-deal');
  ok(/AI 更新建议（3）/.test(t2) && /\+ MCCB[^−]*× 500/.test(t2) && /− MCCB[^+]*× 200/.test(t2) && /你手动改过/.test(t2), '显示 3 条更新建议（需求显示 + 新增 / − 去掉；含被锁定字段的提示）');
  ok(/≈ \$7,000/.test(t2), '采纳前不改动作战卡');
  // 采纳第一条（需求），忽略条款
  await p.click('#tl-deal .tl-sug .tl-sug-row .tl-primary');
  await p.waitForTimeout(300);
  t2 = await p.textContent('#tl-deal');
  ok(/× 500/.test(t2) && /AI 更新建议（2）/.test(t2), '采纳“需求”：数量变为 500');
  const rows = await p.$$('#tl-deal .tl-sug-row');
  for (const r of rows) if (/条款/.test(await r.textContent())) { await (await r.$('.tl-ghost')).click(); break; }
  await p.waitForTimeout(300);
  t2 = await p.textContent('#tl-deal');
  ok(/手动确认/.test(t2) && /AI 更新建议（1）/.test(t2), '忽略“条款”：保留手动内容');
  await p.click('#tl-deal .tl-sug .tl-mini'); // 全部采纳
  await p.waitForTimeout(300);
  ok(/≈ \$17,500/.test(await p.textContent('#tl-deal')) && !/AI 更新建议/.test(await p.textContent('#tl-deal')), '全部采纳：金额更新为 $17,500');

  // 复制到 Excel
  await p.click('text=复制到 Excel');
  await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip.split('\n')[0].startsWith('客户\t热度') && clip.split('\n')[1].includes('Al Noor Electrical'), '复制到 Excel：表头 + 一行数据');
  // 摘要页
  await p.click('#tl-deal .tl-tab:nth-child(2)');
  await p.waitForTimeout(150);
  ok(/进展摘要/.test(await p.textContent('#tl-deal')) && /我方要做/.test(await p.textContent('#tl-deal')), '摘要页：要点 + 待办');
  await p.click('#tl-deal .tl-tab:nth-child(1)');
  await p.click('#tl-deal .tl-link');
  ok(await p.evaluate(() => window.__openedDeals === true), '点“今日跟进”打开跟进页');
  await p.waitForTimeout(200);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'deal-card2.png') });
  fs.writeFileSync(require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'deals-store.json'), JSON.stringify(await p.evaluate(() => window.__store.wadlDeals)));
  console.log('errors', errs);
  await b.close();
})();
