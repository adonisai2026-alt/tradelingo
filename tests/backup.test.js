const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'zh-CN', viewport: { width: 900, height: 1600 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 模拟的存储放在测试进程里（不用 sessionStorage：本地文件页面刷新时它偶尔会丢，导致测试不稳定）
  let nodeStore = { apiKey: 'k:fx', deepseekKey: 'sk-ds', phrases: '报价 | 测试话术', wadlDeals: { c1: { title: 'Al Noor', card: { stage: '谈判' }, analyzedAt: 5 } }, wadlChatLangs: { c1: { l: 'AR', m: true, t: 1 } }, wadlCache: { big: 1 } };
  await ctx.exposeFunction('__nodeStore', (op, o) => { if (op === 'wipe') nodeStore = {}; if (op === 'set') Object.assign(nodeStore, o); return JSON.parse(JSON.stringify(nodeStore)); });
  await p.addInitScript(() => {
    let store = {};
    window.__wipe = () => window.__nodeStore('wipe');
    window.__store = () => store;
    const load = async () => (store = await window.__nodeStore('get'));
    window.chrome = {
      storage: { local: { get: async (d) => { await load(); if (d === null) return JSON.parse(JSON.stringify(store)); const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return JSON.parse(JSON.stringify(o)); }, set: async (o) => { store = await window.__nodeStore('set', JSON.parse(JSON.stringify(o))); } } },
      runtime: { getManifest: () => ({ version: '0.7.0' }), getURL: (x) => x, lastError: null, sendMessage: (m, cb) => cb({ ok: true, text: 'ok', count: 0 }) },
      tabs: { create: (o) => { window.__tab = o.url; } }
    };
  });
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  await p.goto('file://' + require('path').join(__dirname, '..', 'extension') + '/' + 'options.html?page=1');
  await p.waitForTimeout(300);
  ok(await p.isChecked('#notifyEnabled') && (await p.inputValue('#notifyWaitHours')) === '4' && (await p.inputValue('#digestHour')) === '9', '提醒默认开启，4 小时，早报 09:00');
  await p.selectOption('#notifyWaitHours', '8');
  await p.waitForTimeout(100);
  ok((await p.evaluate(() => window.__store().notifyWaitHours)) === 8, '修改阈值保存为数字 8');
  // 导出（不含 Key）
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBackup')]);
  let bk = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(bk.app === 'TradeLingo' && bk.deals.c1 && bk.chatLangs.c1 && bk.settings.phrases === '报价 | 测试话术' && !('apiKey' in bk.settings) && !('wadlCache' in bk), '导出：含作战卡/语言/话术，不含 Key 和翻译缓存');
  // 导出（含 Key）
  await p.check('#backupKeys');
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBackup')]);
  const withKeys = await dl.path();
  bk = JSON.parse(fs.readFileSync(withKeys, 'utf8'));
  ok(bk.settings.deepseekKey === 'sk-ds' && bk.includesKeys, '勾选后导出包含 API Key');
  ok(/含 API Key，请妥善保管/.test(await p.textContent('#statusBackup')), '提示妥善保管');
  // 清空 → 导入
  await p.evaluate(() => window.__wipe());
  await p.reload();
  await p.waitForFunction(() => document.getElementById('ver').textContent.length > 0); // 设置页初始化完成
  await p.waitForTimeout(300);
  await p.setInputFiles('#importFile', withKeys);
  await p.waitForTimeout(500);
  ok(/新增 1 张/.test(await p.textContent('#statusBackup')), '导入提示：' + (await p.textContent('#statusBackup')).trim());
  const st = await p.evaluate(() => window.__store());
  ok(st.wadlDeals.c1.card.stage === '谈判' && st.wadlChatLangs.c1.l === 'AR' && st.deepseekKey === 'sk-ds' && st.notifyWaitHours === 8, '恢复后作战卡、语言、Key、设置全部回来');
  await p.waitForTimeout(1700);
  ok((await p.inputValue('#deepseekKey')) === 'sk-ds', '页面刷新后显示恢复的设置');
  // 错误文件
  fs.writeFileSync(require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'bad.json'), '{"hello":1}');
  await p.setInputFiles('#importFile', require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'bad.json'));
  await p.waitForTimeout(300);
  ok(/不是 TradeLingo 的备份/.test(await p.textContent('#statusBackup')), '错误文件给出提示');
  // 弹窗模式：导入会打开完整设置页
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 400, height: 600 });
  await p2.addInitScript(() => { window.chrome = { storage: { local: { get: async (d) => (d && typeof d === 'object' ? d : {}), set: async () => {} } }, runtime: { getManifest: () => ({ version: '0.7.0' }), getURL: (x) => x, lastError: null, sendMessage: (m, cb) => cb({ ok: true }) }, tabs: { create: (o) => { window.__tab = o.url; } } }; });
  await p2.goto('file://' + require('path').join(__dirname, '..', 'extension') + '/' + 'options.html');
  await p2.waitForTimeout(300);
  await p2.click('#importBackup');
  ok(/options\.html\?page=1#backup/.test(await p2.evaluate(() => window.__tab || '')), '在弹出窗口点导入：打开完整设置页（避免选文件时弹窗关闭）');
  await p.evaluate(() => document.getElementById('remind').scrollIntoView());
  await p.locator('#remind').screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'remind-card.png') });
  await p.locator('#backup').screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'backup-card.png') });
  console.log('errors', errs);
  await b.close();
})();
