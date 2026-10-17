const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2] || require('path').join(__dirname, '..', 'extension') + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 1000, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const store = { apiKey: 'k:fx', qwenKey: 'q', outgoingEngine: 'qwen', backTranslate: true };
    window.chrome = { storage: { local: { get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; }, set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } },
      runtime: { lastError: null, sendMessage: (m, cb) => setTimeout(() => cb({ ok: true, engine: 'qwen', note: '', results: m.texts.map((t) => ({ text: t === '你好朋友' ? 'Ciao amico' : t === '多行\n第二行' ? 'Righe\nSeconda riga' : '【中】' + t, detected: 'IT' })) }), 50) } };
  });
  await p.goto('file://' + __dirname + '/fixtures/lexmock.html');
  for (const f of ['i18n.js', 'common.js', 'content.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  await p.waitForTimeout(600);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  const input = 'footer [contenteditable]';
  await p.click(input); await p.keyboard.type('你好朋友');
  ok(await p.evaluate(() => modelText()) === '你好朋友', '模拟编辑器输入正常');
  await p.click('#wadl-bar .wadl-go'); await p.waitForTimeout(800);
  let m = await p.evaluate(() => ({ model: modelText(), toast: (document.getElementById('wadl-toast') || {}).textContent || '', show: document.getElementById('wadl-toast') && document.getElementById('wadl-toast').classList.contains('wadl-show') }));
  ok(m.model === 'Ciao amico', '译：输入框内容被替换为译文（编辑器内部内容="' + m.model + '"）');
  ok(!m.show, '没有弹出“无法写入”提示' + (m.show ? '：' + m.toast : ''));
  await p.click('#wadl-bar .wadl-undo'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => modelText()) === '你好朋友', '↩ 原文：恢复为中文');
  // 多行
  await p.evaluate(() => { document.querySelector('footer [contenteditable]').focus(); });
  await p.evaluate(() => resetEditor()); await p.waitForTimeout(50);
  await p.keyboard.type('多行'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('第二行');
  await p.click('#wadl-bar .wadl-go'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => modelText()) === 'Righe\nSeconda riga', '多行文本替换正确：' + JSON.stringify(await p.evaluate(() => modelText())));
  // 话术
  await p.evaluate(() => resetEditor()); await p.waitForTimeout(50);
  await p.keyboard.type('/交'); await p.waitForTimeout(200);
  console.log('menu', await p.evaluate(() => ({ disp: document.getElementById('wadl-phrases').style.display, items: [...document.querySelectorAll('.wadl-ph-item b')].map((x) => x.textContent).join(','), model: modelText() })));
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  console.log('after', await p.evaluate(() => ({ model: modelText(), dom: document.querySelector('footer [contenteditable]').innerText, sent })));
  const ph = await p.evaluate(() => ({ model: modelText(), sent: sent.length }));
  ok(ph.sent === 0 && ph.model.startsWith('【中】常规型号'), '话术：替换掉 “/交” 并填入译文：' + ph.model.slice(0, 20));
  const bar = await p.evaluate(() => { const r = document.querySelector('#wadl-bar').getBoundingClientRect(); const u = document.querySelector('#wadl-bar .wadl-undo').getBoundingClientRect(); return { bh: r.height, uh: u.height }; });
  console.log('bar', JSON.stringify(bar), 'errors', errs);
  await b.close();
})();
