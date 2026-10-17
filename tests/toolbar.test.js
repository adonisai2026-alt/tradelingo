const { chromium } = require('playwright');
const fs = require('fs');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ locale: 'zh-CN', viewport: { width: 1100, height: 760 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const store = { apiKey: 'k:fx', qwenKey: 'q', outgoingEngine: 'qwen', backTranslate: true, autoChatLang: true };
    const listeners = [];
    window.__store = store; window.__reqs = [];
    window.chrome = {
      storage: {
        local: {
          get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; },
          set: async (o) => { const ch = {}; for (const k in o) { ch[k] = { newValue: o[k] }; store[k] = o[k]; } listeners.forEach((f) => f(ch, 'local')); }
        },
        onChanged: { addListener: (f) => listeners.push(f) }
      },
      runtime: {
        lastError: null,
        sendMessage: (msg, cb) => {
          window.__reqs.push(msg);
          const det = (t) => /[؀-ۿ]/.test(t) ? 'AR' : /[а-яё]/i.test(t) ? 'RU' : /[一-鿿]/.test(t) ? 'ZH' : 'EN';
          setTimeout(() => cb({ ok: true, engine: msg.engine || (msg.direction === 'outgoing' ? 'qwen' : 'deepl'), note: '',
            results: msg.texts.map((t) => msg.target.startsWith('ZH') ? { text: '【中】' + t, detected: det(t) } : { text: `[${msg.target}] ${t}`, detected: 'ZH' }) }), 60);
        }
      }
    };
  });
  await p.goto('file://' + __dirname + '/fixtures/fake-wa.html');
  await p.evaluate(() => setChat('966000000001', [[0, 'السلام عليكم، أحتاج قاطع دائرة 63 أمبير'], [1, 'Hello'], [0, 'كم السعر من فضلك؟']]));
  for (const f of ['i18n.js', 'common.js', 'content.js']) await p.addScriptTag({ content: fs.readFileSync(dir + f, 'utf8') });
  await p.addStyleTag({ content: fs.readFileSync(dir + 'content.css', 'utf8') });
  const barState = () => p.evaluate(() => { const bar = document.getElementById('wadl-bar'); return { show: bar.style.display, mode: bar.querySelector('.wadl-mode').textContent, lang: bar.querySelector('select').value }; });
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  await p.waitForTimeout(800);
  let st = await barState();
  ok(st.show === 'flex' && st.mode === '自动' && st.lang === 'AR', '聊天 A（阿拉伯语客户）自动识别为阿拉伯语：' + JSON.stringify(st));
  const trCount = await p.evaluate(() => document.querySelectorAll('.wadl-tr').length);
  ok(trCount === 2, '收到的 2 条阿语消息显示译文（自己发的不译）');

  // 切换到哈萨克语客户
  await p.evaluate(() => setChat('77000000002', [[0, 'Сәлеметсіз бе, бағасы қанша?'], [0, 'Маған 100 дана керек']]));
  await p.waitForTimeout(900);
  st = await barState();
  ok(st.mode === '自动' && st.lang === 'KK', '聊天 B（哈萨克语客户）自动识别为哈萨克语：' + JSON.stringify(st));
  // 手动改成俄语
  await p.selectOption('#wadl-bar select', 'RU');
  await p.waitForTimeout(300);
  st = await barState();
  ok(st.mode === '手动' && st.lang === 'RU', '聊天 B 手动指定俄语：' + JSON.stringify(st));
  // 切回 A，再切回 B
  await p.evaluate(() => setChat('966000000001', [[0, 'كم السعر من فضلك؟']]));
  await p.waitForTimeout(700);
  ok((await barState()).lang === 'AR', '切回聊天 A 仍是阿拉伯语');
  await p.evaluate(() => setChat('77000000002', [[0, 'Сәлеметсіз бе']]));
  await p.waitForTimeout(700);
  st = await barState();
  ok(st.mode === '手动' && st.lang === 'RU', '切回聊天 B 仍是手动俄语');
  const stored = await p.evaluate(() => JSON.stringify(window.__store.wadlChatLangs || {}));
  ok(!/77000000002|966000000001/.test(stored), '存储中不含电话号码（只存哈希）：' + stored);
  // 恢复自动
  await p.selectOption('#wadl-bar select', '__auto');
  await p.waitForTimeout(300);
  st = await barState();
  ok(st.mode === '自动' && st.lang === 'KK', '恢复自动识别 → 哈萨克语：' + JSON.stringify(st));

  // 切到 A，翻译 + 回译
  await p.evaluate(() => setChat('966000000001', [[0, 'كم السعر من فضلك؟']]));
  await p.waitForTimeout(700);
  const input = 'footer [contenteditable]';
  await p.click(input);
  await p.keyboard.type('价格是每个 12 美元');
  await p.click('#wadl-bar .wadl-go');
  await p.waitForTimeout(500);
  const afterTr = await p.evaluate(() => ({ input: document.querySelector('footer [contenteditable]').innerText, back: document.getElementById('wadl-back').innerText, backShow: document.getElementById('wadl-back').style.display }));
  ok(afterTr.input === '[AR] 价格是每个 12 美元', '发送翻译用聊天语言（阿拉伯语）：' + afterTr.input);
  ok(afterTr.backShow === 'flex' && afterTr.back.includes('【中】[AR] 价格是每个 12 美元'), '回译框显示中文回译：' + afterTr.back.replace(/\n/g, ' '));
  const backReq = await p.evaluate(() => window.__reqs.filter((r) => r.source).pop());
  ok(backReq && backReq.engine === 'deepl' && backReq.source === 'AR' && backReq.target === 'ZH-HANS', '回译请求：DeepL、源语言 AR → 简体中文');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'ui-back.png') });
  // 清空输入框 → 回译框消失
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1700);
  ok(await p.evaluate(() => document.getElementById('wadl-back').style.display) === 'none', '发送后回译框自动消失');

  // 快捷话术
  await p.click(input);
  await p.keyboard.type('/交');
  await p.waitForTimeout(300);
  const menu = await p.evaluate(() => ({ show: document.getElementById('wadl-phrases').style.display, items: [...document.querySelectorAll('.wadl-ph-item b')].map((x) => x.textContent) }));
  ok(menu.show === 'block' && menu.items[0] === '交期', '输入 /交 弹出话术菜单：' + JSON.stringify(menu.items));
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'tradelingo-test-shots', 'ui-phrase.png') });
  const sentBefore = await p.evaluate(() => sentLog.length);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  const afterPh = await p.evaluate(() => ({ input: document.querySelector('footer [contenteditable]').innerText, sent: sentLog.length, back: document.getElementById('wadl-back').innerText }));
  ok(afterPh.sent === sentBefore, 'Enter 选择话术时没有把 “/交” 发出去');
  ok(afterPh.input.startsWith('[AR] 常规型号有现货'), '话术已翻译成阿拉伯语填入：' + afterPh.input.slice(0, 30));
  ok(afterPh.back.includes('话术原文'), '回译框显示话术中文原文');
  // 方向键 + Esc
  await p.evaluate(() => { document.querySelector('footer [contenteditable]').innerText = ''; });
  await p.click(input); await p.keyboard.type('/');
  await p.waitForTimeout(200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const idx = await p.evaluate(() => [...document.querySelectorAll('.wadl-ph-item')].findIndex((x) => x.classList.contains('wadl-active')));
  await p.keyboard.press('Escape');
  const closed = await p.evaluate(() => document.getElementById('wadl-phrases').style.display);
  ok(idx === 2 && closed === 'none', '方向键移动选择，Esc 关闭菜单');
  console.log('page errors:', errs);
  await b.close();
})();
