const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const mock = (init) => {
  const store = init; const ls = []; window.__store = store; window.__tabs = []; window.__msgs = [];
  window.chrome = {
    storage: { local: {
      get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
      set: async (o) => { const ch = {}; for (const k in o) { store[k] = o[k]; ch[k] = { newValue: o[k] }; } ls.forEach((f) => f(ch, 'local')); } },
      onChanged: { addListener: (f) => ls.push(f) } },
    tabs: { create: (o) => window.__tabs.push(o.url) },
    runtime: { lastError: null, getManifest: () => ({ version: '0.8.0' }), getURL: (p) => p, sendMessage: (m, cb) => {
      window.__msgs.push(m);
      if (m.type === 'test') setTimeout(() => cb(m.key === 'sk-good' ? { ok: true, text: '连接成功（0.8s）：试译 “Hello”' } : { ok: false, error: 'Qwen-MT API Key 无效（注意：北京地域的 Key 不能用于国际地域，反之亦然）' }), 50);
      else if (m.type === 'checkUpdate') setTimeout(() => cb({ ok: true, info: { latest: '0.9.0', current: '0.8.0', hasNew: true, date: '2026-11-01', notes: ['新增：语音转文字', '修复：引用消息识别'], checkedAt: Date.now(), download: 'https://github.com/adonisai2026-alt/tradelingo/archive/refs/heads/main.zip', changelog: 'https://github.com/adonisai2026-alt/tradelingo/blob/main/CHANGELOG.md' } }), 30);
      else cb({ ok: true });
    } }
  };
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(mock, {});
  await p.goto('file://' + dir + 'welcome.html');
  await p.waitForTimeout(200);
  ok(await p.isVisible('#s1') && await p.$eval('#engines .opt.on', (e) => e.dataset.e) === 'qwen', '向导第 1 步：默认推荐通义千问');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'wz1.png'), fullPage: true });
  await p.click('#to2'); await p.waitForTimeout(100);
  ok(/阿里云百炼控制台/.test(await p.textContent('#kHow')) && await p.isVisible('#region'), '第 2 步：显示百炼申请步骤和地域选择');
  ok(await p.$eval('#to3', (e) => e.disabled), '测试通过前不能进入下一步');
  await p.fill('#key', 'sk-bad'); await p.click('#test'); await p.waitForTimeout(200);
  ok(/无效/.test(await p.textContent('#kStatus')) && /地域/.test(await p.textContent('#kStatus')) && await p.$eval('#to3', (e) => e.disabled), 'Key 错误：显示原因并提醒检查地域');
  await p.fill('#key', 'sk-good'); await p.selectOption('#region', 'beijing'); await p.click('#test'); await p.waitForTimeout(200);
  ok(/连接成功/.test(await p.textContent('#kStatus')) && !(await p.$eval('#to3', (e) => e.disabled)), 'Key 正确：显示试译结果，可以下一步');
  ok(await p.evaluate(() => window.__store.qwenKey === 'sk-good' && window.__store.qwenRegion === 'beijing'), 'Key 和地域已保存');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'wz2.png'), fullPage: true });
  await p.click('#to3'); await p.waitForTimeout(150);
  ok(await p.isVisible('#dsNote'), '第 3 步：没填 DeepSeek 时提示作战卡需要 DeepSeek');
  await p.selectOption('#outT', 'AR');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'wz3.png'), fullPage: true });
  await p.click('#to4'); await p.waitForTimeout(150);
  const st = await p.evaluate(() => window.__store);
  ok(st.incomingEngine === 'qwen' && st.outgoingEngine === 'qwen' && st.outgoingTarget === 'AR' && st.wadlWelcomeDone, '完成：只填了千问时收发都用千问，语言已保存');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'wz4.png'), fullPage: true });
  await p.click('#openWA');
  ok((await p.evaluate(() => window.__tabs)).includes('https://web.whatsapp.com/'), '点按钮打开 WhatsApp 网页');

  // DeepL 选错 Key 类型
  await p.reload(); await p.waitForTimeout(150);
  await p.click('#engines .opt[data-e=deepl]'); await p.click('#to2'); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#region')) && /信用卡/.test(await p.textContent('#kHow')), 'DeepL：说明需要信用卡，不显示地域');
  await p.fill('#key', 'sk-abc'); await p.click('#test'); await p.waitForTimeout(100);
  ok(/不是 DeepL 的/.test(await p.textContent('#kStatus')), '在 DeepL 里粘贴了 sk- 开头的 Key：提示选错引擎');

  // 手机宽度
  await p.setViewportSize({ width: 390, height: 844 }); await p.reload(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), '手机宽度无横向滚动');

  // ---------- 设置页 ----------
  const o = await b.newPage({ locale: 'zh-CN', viewport: { width: 400, height: 900 } });
  o.on('pageerror', (e) => errs.push(e.message));
  await o.addInitScript(mock, { qwenKey: 'sk-good', wadlUsage: { month: new Date().toISOString().slice(0, 7), qwen: 12345, deal: 6789, prev: { month: '2026-09', qwen: 1000, deepl: 500 } } });
  await o.goto('file://' + dir + 'options.html');
  await o.waitForTimeout(250);
  ok(await o.textContent('#ver') === '0.8.0', '设置页显示当前版本号（读 manifest）');
  ok(!(await o.isVisible('#update')), '没有更新时不显示横幅');
  ok(!(await o.isVisible('#welcomeCard')), '已填 Key：不显示向导入口卡片');
  const u = await o.textContent('#usage');
  ok(/12,345 字符/.test(u) && /6,789/.test(u) && /上月（2026-09）合计/.test(u) && /1,500/.test(u), '本月用量：各引擎字符数和上月合计');
  await o.click('#checkUpdate'); await o.waitForTimeout(150);
  ok(await o.isVisible('#update') && /0\.9\.0/.test(await o.textContent('#update')) && /语音转文字/.test(await o.textContent('#updNotes')), '检查到新版本：顶部显示版本和更新内容');
  ok((await o.getAttribute('#updDownload', 'href')).endsWith('main.zip'), '下载按钮指向 GitHub ZIP');
  await o.click('#updHow summary'); await o.waitForTimeout(80);
  await o.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'opt-update.png') });
  await o.evaluate(() => document.getElementById('usageCard').scrollIntoView());
  await o.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'opt-usage.png') });
  const o2 = await b.newPage({ locale: 'zh-CN', viewport: { width: 400, height: 700 } });
  await o2.addInitScript(mock, {});
  await o2.goto('file://' + dir + 'options.html'); await o2.waitForTimeout(200);
  ok(await o2.isVisible('#welcomeCard'), '还没填任何 Key：设置页顶部显示“打开使用向导”');
  await o2.click('#openWelcome');
  ok((await o2.evaluate(() => window.__tabs))[0] === 'welcome.html', '点击打开向导页');
  console.log('errors', errs);
  await b.close();
})();
