const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const real = JSON.parse(fs.readFileSync(require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'deals-store.json'), 'utf8'));
  const now = Date.now(), day = 86400000;
  const deals = {
    ...real,
    cKZ: { title: 'Almaty Energo', analyzedAt: now - 3 * day, lastIn: now - 9 * day, lastOut: now - 6 * day, pending: 0,
      card: { customer: { company: 'Almaty Energo', country: '阿拉木图', type: '工程商' }, heat: { level: '中' }, stage: '报价', value: { amount: 2500, currency: 'USD', basis: '50 × $50' },
        needs: [{ item: '接触器 32A', qty: '50', target: null }], next: { owner: '客户', action: '等客户确认', due: null }, missing: [{ field: '电压等级' }] } },
    cBD: { title: 'Dhaka Power', analyzedAt: now - day, lastIn: now - 2 * day, lastOut: now - day, pending: 2,
      card: { customer: { company: 'Dhaka Power Solutions', country: '达卡' }, heat: { level: '低' }, stage: '询盘', value: { amount: null }, needs: [{ item: 'ATS 400A' }], missing: [{ field: '数量' }] } }
  };
  await p.addInitScript((d) => {
    const store = { wadlDeals: d };
    window.chrome = { storage: { local: { get: async (x) => ({ wadlDeals: store.wadlDeals }), set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } } };
  }, deals);
  await p.goto('file://' + require('path').join(__dirname, '..', 'extension') + '/' + 'deals.html');
  await p.waitForTimeout(400);
  const names = await p.$$eval('li .name', (xs) => xs.map((x) => x.textContent));
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ok(names[0] === 'Al Noor Electrical' && names.length === 3, '排序：第一位是 Al Noor（金额大、热度高、承诺今天到期）→ ' + names.join(' > '));
  const why = await p.textContent('li:first-child .why');
  ok(/今天到期/.test(why) && /在等你/.test(why), '第一位给出原因：' + why.replace(/\s+/g, ' ').slice(0, 60));
  ok(/客户 6 天未回复/.test(await p.textContent('#list')), '显示客户沉默天数');
  await p.click('text=报价 1');
  ok((await p.$$('li')).length === 1, '按阶段筛选');
  await p.click('text=全部 3');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok(csv.charCodeAt(0) === 0xfeff && csv.split('\r\n').length === 4 && csv.includes('客户,热度,阶段'), 'CSV 导出：带 BOM（Excel 中文不乱码）、表头 + 3 行');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'deals-page.png') });
  console.log('errors', errs);
  await b.close();
})();
