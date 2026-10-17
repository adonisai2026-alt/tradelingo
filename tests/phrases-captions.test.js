const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const mock = (init) => {
  const store = { apiKey: 'k:fx', qwenKey: 'q', uiLang: 'zh', backTranslate: true, ...init };
  const ls = []; window.__store = store;
  window.chrome = {
    i18n: { detectLanguage: (t, cb) => cb({ isReliable: true, languages: [{ language: /[؀-ۿ]/.test(t) ? 'ar' : 'en' }] }) },
    storage: { local: { get: async (d) => { if (typeof d === 'string') d = { [d]: undefined }; const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; }, set: async (o) => { const ch = {}; for (const k in o) { store[k] = o[k]; ch[k] = { newValue: o[k] }; } ls.forEach((f) => f(ch, 'local')); } }, onChanged: { addListener: (f) => ls.push(f) } },
    runtime: { lastError: null, getManifest: () => ({ version: '0.10.1' }), getURL: (x) => x, sendMessage: (m, cb) => { cb = cb || (() => {}); if (m.texts) setTimeout(() => cb({ ok: true, engine: 'qwen', note: '', results: m.texts.map((t) => ({ text: '[' + m.target + '] ' + t, detected: 'ZH' })) }), 40); else cb({ ok: true }); } }
  };
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (init) => {
    const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(mock, init || {});
    await p.goto('file://' + __dirname + '/fixtures/wa-mock.html');
    for (const f of ['i18n.js', 'common.js', 'dealcore.js', 'content.js', 'deal.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
    await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
    await p.waitForTimeout(800);
    return p;
  };
  const vis = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, s);
  const inp = 'footer [contenteditable]';
  const clickPh = (p) => p.evaluate(() => document.querySelector('#wadl-bar .wadl-ph').click());

  // ---------- 1. 点“话” ----------
  let p = await page();
  await p.click(inp);
  await clickPh(p); await p.waitForTimeout(2500);
  ok(await vis(p, '#wadl-phrases'), '输入框为空时点“话”：话术框持续显示（2.5 秒后仍在）');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'fix1.png') });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok(!(await vis(p, '#wadl-phrases')), '按 Esc 关闭');
  await clickPh(p); await p.waitForTimeout(200);
  await p.mouse.click(600, 200); await p.waitForTimeout(200);
  ok(!(await vis(p, '#wadl-phrases')), '点页面其他地方关闭');
  await clickPh(p); await p.waitForTimeout(200); await clickPh(p); await p.waitForTimeout(200);
  ok(!(await vis(p, '#wadl-phrases')), '再点一次“话”关闭');
  await p.click(inp); await clickPh(p); await p.waitForTimeout(300);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  ok(/^\[AR\] 我们需要|^\[AR\] 请提供/.test(await p.textContent(inp)), '空输入框：用方向键选第 2 条，Enter 插入并翻译：' + (await p.textContent(inp)).slice(0, 30));
  await p.evaluate((s) => { document.querySelector(s).innerText = ''; }, inp);
  await p.click(inp); await p.keyboard.type('Dear Ahmed,'); await p.waitForTimeout(300);
  await clickPh(p); await p.waitForTimeout(1600);
  ok(await vis(p, '#wadl-phrases'), '输入框有文字时点“话”：话术框持续显示');
  await p.click('#wadl-phrases .wadl-ph-item'); await p.waitForTimeout(800);
  const t1 = await p.textContent(inp);
  ok(t1.startsWith('Dear Ahmed, [AR] ') && /感谢您的咨询/.test(t1), '插入话术时保留已写的文字：' + t1.slice(0, 40));
  // 触发键方式不受影响
  await p.evaluate((s) => { document.querySelector(s).innerText = ''; }, inp);
  await p.click(inp); await p.keyboard.type('/交'); await p.waitForTimeout(300);
  ok(await vis(p, '#wadl-phrases') && (await p.$$('#wadl-phrases .wadl-ph-item')).length === 1, '输入“/交”：筛出 1 条');
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.waitForTimeout(400);
  ok(!(await vis(p, '#wadl-phrases')), '删掉“/”后话术框自动关闭（触发键方式）');

  // ---------- 2. 图片 + 说明 ----------
  for (const variant of ['footer 还在', 'footer 被移除']) {
    p = await page();
    await p.evaluate((v) => {
      const main = document.getElementById('main');
      const ov = document.createElement('div'); ov.id = 'media';
      ov.style.cssText = 'position:absolute;inset:0;background:#e9edef;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:20px;z-index:50';
      ov.innerHTML = '<div style="width:320px;height:220px;background:#9ab;margin-bottom:auto;margin-top:60px">[图片]</div><div style="display:flex;width:70%;gap:8px;margin-bottom:30px"><div id="cap" contenteditable="true" role="textbox" style="flex:1;background:#fff;padding:10px;border-radius:8px;min-height:20px"></div></div>';
      main.style.position = 'relative'; main.appendChild(ov);
      if (v === 'footer 被移除') document.querySelector('footer').remove();
    }, variant);
    await p.waitForTimeout(400);
    await p.click('#cap'); await p.keyboard.type('这是我们的产品图片'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__tradelingo.getInput().id === 'cap'), `[${variant}] 识别到“添加说明”输入框`);
    const pos = await p.evaluate(() => ({ bar: document.getElementById('wadl-bar').getBoundingClientRect().bottom, cap: document.getElementById('cap').getBoundingClientRect().top }));
    ok(Math.abs(pos.cap - pos.bar) < 20, `[${variant}] 工具条显示在说明框上方`);
    await p.evaluate(() => document.querySelector('#wadl-bar .wadl-go').click()); await p.waitForTimeout(900);
    ok((await p.textContent('#cap')) === '[AR] 这是我们的产品图片' && await vis(p, '#wadl-back'), `[${variant}] 点“译”翻译说明文字，并显示回译`);
    if (variant === 'footer 还在') {
      await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'fix2.png') });
      await p.evaluate(() => document.getElementById('media').remove()); await p.waitForTimeout(400);
      ok(await p.evaluate(() => window.__tradelingo.getInput().closest('footer') !== null), '关闭图片界面后，回到聊天输入框');
    }
  }
  // 普通聊天：仍然选 footer 里的输入框（即使焦点在别处）
  p = await page();
  await p.click('#side .search div').catch(() => {});
  ok(await p.evaluate(() => !!window.__tradelingo.getInput().closest('footer')), '普通聊天：仍识别聊天输入框');

  // ---------- 3. WhatsApp Business 与触发键 ----------
  const addWaQr = (p) => p.evaluate((s) => {
    const inp = document.querySelector(s);
    const box = document.createElement('div'); box.id = 'wa-qr';
    box.style.cssText = 'position:fixed;left:320px;bottom:60px;width:380px;background:#fff;border:2px solid #25d366;padding:8px;display:none;z-index:5';
    box.textContent = 'WhatsApp 快捷回复 /thanks'; document.body.appendChild(box);
    window.__waPicked = '';
    inp.addEventListener('input', () => { box.style.display = inp.innerText.startsWith('/') ? 'block' : 'none'; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && box.style.display === 'block') { e.preventDefault(); window.__waPicked = 'thanks'; inp.innerText = 'Thank you for your order!'; box.style.display = 'none'; } });
  }, inp);
  p = await page({ phraseTrigger: ';' });
  await addWaQr(p);
  await p.click(inp); await p.keyboard.type('/'); await p.waitForTimeout(400);
  ok(await vis(p, '#wa-qr') && !(await vis(p, '#wadl-phrases')), '触发键设为“;”：输入“/”只出现 WhatsApp 的快捷回复');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__waPicked)) === 'thanks', 'Enter 正常选中 WhatsApp 快捷回复（不再被插件抢走）');
  await p.evaluate((s) => { document.querySelector(s).innerText = ''; }, inp);
  await p.click(inp); await p.keyboard.type(';报'); await p.waitForTimeout(400);
  ok(await vis(p, '#wadl-phrases') && !(await vis(p, '#wa-qr')), '输入“;报”调出插件话术');
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  ok(/^\[AR\] 这是我们的报价单/.test(await p.textContent(inp)), 'Enter 插入话术');
  await p.evaluate((s) => { document.querySelector(s).innerText = ''; }, inp);
  await p.click(inp); await p.evaluate((s) => { const e = document.querySelector(s); e.innerText = '；交'; e.dispatchEvent(new InputEvent('input', { bubbles: true })); }, inp); await p.waitForTimeout(400);
  ok(await vis(p, '#wadl-phrases'), '中文输入法的全角“；”也能调出');
  ok(/输入 ; 调出/.test(await p.getAttribute('#wadl-bar .wadl-ph', 'title')), '“话”按钮提示显示当前触发键');
  // 实时切换设置
  await p.evaluate(() => chrome.storage.local.set({ phraseTrigger: '/' })); await p.waitForTimeout(200);
  await p.evaluate((s) => { document.querySelector(s).innerText = ''; }, inp);
  await p.click(inp); await p.keyboard.type('/交'); await p.waitForTimeout(400);
  ok(await vis(p, '#wadl-phrases'), '设置改回“/”后立即生效');

  // ---------- 设置页与向导 ----------
  const o = await b.newPage({ locale: 'zh-CN', viewport: { width: 900, height: 900 } });
  await o.addInitScript(mock, {});
  o.on('pageerror', (e) => errs.push(e.message));
  await o.goto('file://' + dir + 'options.html?page=1'); await o.waitForTimeout(300);
  ok((await o.inputValue('#phraseTrigger')) === '/', '设置页：触发键默认“/”');
  await o.selectOption('#phraseTrigger', ';'); await o.waitForTimeout(100);
  ok((await o.evaluate(() => window.__store.phraseTrigger)) === ';', '设置页：改成“;”后保存');
  const w = await b.newPage({ locale: 'zh-CN' });
  await w.addInitScript(mock, { qwenKey: '' }); w.on('pageerror', (e) => errs.push(e.message));
  await w.goto('file://' + dir + 'welcome.html'); await w.waitForTimeout(300);
  await w.evaluate(() => { document.querySelector('#to3').disabled = false; });
  await w.click('#to2'); await w.waitForTimeout(100); await w.click('#skip2'); await w.waitForTimeout(100);
  await w.check('#bizWa'); await w.click('#to4'); await w.waitForTimeout(200);
  ok((await w.evaluate(() => window.__store.phraseTrigger)) === ';' && (await w.textContent('#trigKbd')) === ';', '向导：勾选 WhatsApp Business → 触发键设为“;”，完成页提示同步');
  console.log('errors', errs);
  await b.close();
})();
