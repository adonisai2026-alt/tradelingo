const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const mock = (init) => {
  const store = init; const ls = []; window.__store = store; window.__msgs = []; window.__tabs = []; window.__perm = 0;
  window.confirm = () => true;
  window.chrome = {
    storage: { local: {
      get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? JSON.parse(JSON.stringify(store[k])) : d[k]; return o; },
      set: async (o) => { const ch = {}; for (const k in o) { store[k] = o[k]; ch[k] = { newValue: o[k] }; } ls.forEach((f) => f(ch, 'local')); },
      remove: async () => {} }, onChanged: { addListener: (f) => ls.push(f) } },
    permissions: { request: (q, cb) => { window.__perm++; cb(true); } },
    tabs: { create: (o) => window.__tabs.push(o.url) },
    runtime: { lastError: null, getManifest: () => ({ version: '0.9.1' }), getURL: (x) => x, sendMessage: (m, cb) => {
      window.__msgs.push(m);
      const set = (o) => window.chrome.storage.local.set(o);
      if (m.type === 'notionList') setTimeout(() => cb(m.token === 'ntn_good' ? { ok: true, pages: [{ id: 'pg1', title: 'TradeLingo 商机' }], dbs: [] } : { ok: false, error: 'Notion 密钥无效，请重新复制' }), 30);
      else if (m.type === 'notionCreateDb') { set({ wadlNotion: { db: 'db1', url: 'https://notion.so/db1', title: 'TradeLingo 商机', names: {} }, wadlNotionSync: { map: { a: { url: 'u' }, b: { url: 'u' } }, lastAt: Date.now(), lastCount: 2, error: '' } }).then(() => cb({ ok: true, url: 'https://notion.so/db1', result: { done: 2, failed: 0, error: '' } })); }
      else if (m.type === 'notionSyncNow') setTimeout(() => cb({ ok: true, done: 2, failed: 0, error: '' }), 30);
      else if (m.type === 'notionDisconnect') { delete window.__store.wadlNotion; cb({ ok: true }); }
      else cb({ ok: true });
    } }
  };
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const pop = await b.newPage({ locale: 'zh-CN', viewport: { width: 400, height: 800 } });
  pop.on('pageerror', (e) => errs.push(e.message));
  await pop.addInitScript(mock, {});
  await pop.goto('file://' + dir + 'options.html'); await pop.waitForTimeout(300);
  await pop.fill('#notionToken', 'ntn_good'); await pop.click('#nConnect'); await pop.waitForTimeout(100);
  ok((await pop.evaluate(() => window.__tabs))[0] === 'options.html?page=1#notion' && (await pop.evaluate(() => window.__store.notionToken)) === 'ntn_good', '弹出窗口里点“连接 Notion”：保存密钥并打开完整设置页');
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 900, height: 1000 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(mock, { notionToken: 'ntn_bad' });
  await p.goto('file://' + dir + 'options.html?page=1#notion'); await p.waitForTimeout(400);
  ok(await p.inputValue('#notionToken') === 'ntn_bad' && !(await p.isVisible('#nConnected')), '未连接：显示密钥输入框');
  await p.click('#nConnect'); await p.waitForTimeout(200);
  ok(/密钥无效/.test(await p.textContent('#statusNotion')) && !(await p.isVisible('#nPick')), '密钥错误：提示，不显示页面选择');
  await p.fill('#notionToken', 'ntn_good'); await p.click('#nConnect'); await p.waitForTimeout(200);
  ok((await p.evaluate(() => window.__perm)) >= 1, '连接前请求 api.notion.com 权限');
  ok(await p.isVisible('#nPick') && (await p.$eval('#nPage', (s) => s.options[0].textContent)) === 'TradeLingo 商机', '列出可用页面');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'notion-pick.png'), clip: await (await p.$('#notion')).boundingBox() });
  await p.click('#nCreate'); await p.waitForTimeout(300);
  ok(await p.isVisible('#nConnected') && /已连接：TradeLingo 商机/.test(await p.textContent('#nDbLink')) && /已同步 2 个客户/.test(await p.textContent('#statusNotion')), '创建数据库后：显示已连接和同步结果');
  ok((await p.getAttribute('#nDbLink a', 'href')) === 'https://notion.so/db1', '可以一键打开 Notion 数据库');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'notion-on.png'), clip: await (await p.$('#notion')).boundingBox() });
  await p.click('#nSync'); await p.waitForTimeout(200);
  ok(/已同步 2 个客户/.test(await p.textContent('#statusNotion')), '立即全部同步');
  await p.click('#nDisconnect'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#nConnected')) && /仍然保留/.test(await p.textContent('#statusNotion')), '断开后回到设置状态');
  console.log('errors', errs); await b.close();
})();
