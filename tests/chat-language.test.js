const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 1000, height: 700 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    // 没有 DeepL Key：只有 Qwen，翻译结果不带原文语言
    const store = { qwenKey: 'q', outgoingEngine: 'qwen', incomingEngine: 'qwen', translateOwn: true };
    const L = [[/sono|vorrei|buongiorno|spedizione/i, 'it'], [/eslaysizmi|men |edik|ko'rgazma/i, 'uz'], [/hello|thank|how are you|price/i, 'en'], [/hola|precio/i, 'es']];
    window.chrome = {
      i18n: { detectLanguage: (t, cb) => { const hit = L.find(([re]) => re.test(t)); setTimeout(() => cb(hit ? { isReliable: t.length > 15, languages: [{ language: hit[1], percentage: 90 }] } : { isReliable: false, languages: [] }), 5); } },
      storage: { local: { get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; }, set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } },
      runtime: { lastError: null, sendMessage: (m, cb) => setTimeout(() => cb({ ok: true, engine: 'qwen', note: '', results: m.texts.map((t) => ({ text: '【中】' + t, detected: '' })) }), 20) }
    };
  });
  await p.goto('file://' + __dirname + '/fixtures/fake-wa2.html');
  for (const f of ['i18n.js', 'common.js', 'content.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  const st = () => p.evaluate(() => { const bar = document.getElementById('wadl-bar'); return bar.querySelector('.wadl-mode').textContent + ' ' + bar.querySelector('select').value; });
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  for (const mode of ['jid', 'nojid']) {
    console.log(`== data-id ${mode === 'jid' ? '含聊天 ID' : '不含聊天 ID（靠顶部名称）'}`);
    // 截图 1：给自己发消息，全是自己发出的，意大利语为主
    await p.evaluate((m) => setChat('臧宇辉 (自己)', [[1, 'Hello'], [1, 'Salve, sono un suo cliente e vorrei chiedere informazioni sulla spedizione.'], [1, 'Buongiorno'], [1, 'Buongiorno']], m), mode);
    await p.waitForTimeout(700);
    let s = await st(); ok(s === '自动 IT', '只有自己发的意大利语消息（无 DeepL）→ ' + s);
    // 截图 2：Medeu，自己发了英语问候 + 乌兹别克语长句
    await p.evaluate((m) => setChat('Medeu', [[1, 'Hello Medeu'], [1, "Men Adonisman. Meni eslaysizmi? O'tgan oy Toshkentdagi ko'rgazmada uchrashgan edik."]], m), mode);
    await p.waitForTimeout(700);
    s = await st(); ok(s === '自动 UZ', 'Medeu：自己发的乌兹别克语为主 → ' + s);
    // 状态栏变化（在线 → 正在输入…）不影响聊天识别
    await p.evaluate(() => setStatus('正在输入…')); await p.waitForTimeout(500);
    s = await st(); ok(s === '自动 UZ', '顶部状态变成“正在输入…”后仍是同一个聊天 → ' + s);
    // 客户用英语回复了：客户消息权重更高
    await p.evaluate((m) => setChat('Medeu', [[1, 'Hello Medeu'], [1, "Men Adonisman. Meni eslaysizmi? O'tgan oy Toshkentdagi ko'rgazmada uchrashgan edik."], [0, 'Hello, yes I remember you. What is the price?']], m), mode);
    await p.waitForTimeout(700);
    s = await st(); ok(s === '自动 EN-US', 'Medeu 客户用英语回复 → 改为英语：' + s);
    // 切回自己的聊天仍是意大利语
    await p.evaluate((m) => setChat('臧宇辉 (自己)', [[1, 'Buongiorno']], m), mode);
    await p.waitForTimeout(600);
    s = await st(); ok(s === '自动 IT', '切回“自己”聊天仍是意大利语 → ' + s);
    // 只有中文消息的新聊天 → 默认
    await p.evaluate((m) => setChat('新客户' + m, [[1, '你好']], m), mode);
    await p.waitForTimeout(600);
    s = await st(); ok(s.startsWith('默认'), '只有中文消息 → 默认：' + s);
  }
  // 方向判断：nojid 模式下自己的消息（有勾号）不被当成客户消息
  const dir2 = await p.evaluate(() => document.querySelectorAll('.wadl-tr').length);
  console.log('errors', errs);
  await b.close();
})();
