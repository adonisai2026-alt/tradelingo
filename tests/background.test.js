const fs = require('fs'), vm = require('vm'), path = require('path').join(__dirname, '..', 'extension') + '/';
const store = { apiKey: 'k:fx', deepseekKey: 'sk-1', deepseekModel: 'deepseek-chat', outgoingEngine: 'deepseek' };
let qwMode = 'ok', qwInflight = 0, qwMaxInflight = 0;
let listener, calls = [], dsMode = 'ok', deeplMode = 'ok';
const chrome = {
  storage: { local: {
    get: async (d) => { const o = {}; for (const k in d) o[k] = k in store ? store[k] : d[k]; return o; },
    set: async (o) => Object.assign(store, o), remove: async () => {} } },
  runtime: { onMessage: { addListener: (f) => (listener = f) }, onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} } }, alarms: { get: (n, cb) => cb(null), create() {}, onAlarm: { addListener() {} } }, notifications: { create() {}, onClicked: { addListener() {} } }
};
const resp = (status, obj) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
async function fetch(url, init) {
  if (init.signal) init.signal.addEventListener('abort', () => { try { init._ctrl && init._ctrl.error(new Error('aborted')); } catch (e) {} });
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ url, body });
  if (url.includes('dashscope')) {
    if (qwMode === 'fail') return resp(401, { error: { message: 'Incorrect API key', code: 'invalid_api_key' } });
    if (qwMode === 'arrears') return resp(400, { error: { message: 'Access denied, please make sure your account is in good standing.', code: 'Arrearage' } });
    qwInflight++; qwMaxInflight = Math.max(qwMaxInflight, qwInflight);
    await new Promise((r) => setTimeout(r, 30));
    qwInflight--;
    return resp(200, { choices: [{ message: { role: 'assistant', content: 'QW:' + body.messages[0].content } }] });
  }
  if (url.includes('deepseek')) {
    if (url.endsWith('/user/balance')) return resp(200, { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '9.90' }] });
    if (dsMode === 'fail') return resp(401, {});
    if (/作战卡/.test(body.messages[0].content)) {
      const u = JSON.parse(body.messages[1].content);
      window.__lastDeal = { sys: body.messages[0].content, user: u, model: body.model, thinking: body.thinking };
      const card = u.card ? { ...u.card, needs: [{ item: 'MCCB 250A 3P', qty: '500', target: '$35', src: [u.messages[0].id] }], changed: [{ field: 'needs', reason: '客户把数量改为 500' }] }
        : { customer: { name: 'Ahmed', company: 'Al Noor', country: '迪拜', type: '分销商' }, heat: { level: '高', reason: '问交期', src: [2] }, stage: '谈判',
            value: { amount: 7000, currency: 'USD', basis: '200 × $35' }, needs: [{ item: 'MCCB 250A 3P', qty: '200', target: '$35', src: [1] }], terms: null,
            blockers: [], next: { owner: '我方', action: '发 PI', due: null, draft_zh: '您好，这是形式发票。', src: [2] }, commitments: [], quotes: [], missing: [], summary: ['客户询价'] };
      const content = '```json\n' + JSON.stringify(card) + '\n```';
      const enc = new TextEncoder();
      const stream = new ReadableStream({ start(c) { for (let k = 0; k < content.length; k += 50) c.enqueue(enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: content.slice(k, k + 50) } }] }) + '\n\n')); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); } });
      return { ok: true, status: 200, body: stream, text: async () => '' };
    }
    const items = JSON.parse(body.messages[1].content).items;
    const content = (dsMode === 'fence' ? '```json\n' : '') + JSON.stringify({ items: items.map((i) => ({ id: i.id, lang: 'zh', text: 'AI:' + i.text })) }) + (dsMode === 'fence' ? '\n```' : '');
    const enc = new TextEncoder();
    const ev = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
    const stream = new ReadableStream({ async start(c) {
      init._ctrl = c;
      if (dsMode === 'stall') { c.enqueue(enc.encode('\n')); return; } // 之后再无数据
      if (dsMode === 'keepalive') for (let k = 0; k < 4; k++) { c.enqueue(enc.encode(': keep-alive\n\n')); await new Promise((r) => setTimeout(r, 200)); }
      if (dsMode === 'blank') { c.enqueue(enc.encode(ev({ choices: [{ delta: { content: ' '.repeat(250) } }] }))); return; }
      for (let k = 0; k < content.length; k += 7) c.enqueue(enc.encode(ev({ choices: [{ delta: { content: content.slice(k, k + 7) } }] })));
      c.enqueue(enc.encode(ev({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'));
      c.close();
    } });
    return { ok: true, status: 200, body: stream, text: async () => '' };
  }
  if (deeplMode === 'fail') return resp(456, {});
  return resp(200, { translations: body.text.map((t) => ({ text: 'DL:' + t, detected_source_language: 'EN' })) });
}
const window = {}; const ctx = { window, chrome, fetch, AbortController, Date, Math, TextDecoder, TextEncoder, ReadableStream, console, setTimeout, clearTimeout, AbortSignal, JSON, Map, Set, Object, Array, String, Number, Error, Promise };
ctx.importScripts = (...fs2) => fs2.forEach((f) => vm.runInContext(fs.readFileSync(path + f, 'utf8'), ctx));
vm.createContext(ctx);
chrome.storage.onChanged = chrome.storage.onChanged || { addListener() {} };
vm.runInContext(fs.readFileSync(path + 'background.js', 'utf8').replace('DS_IDLE_MS = 25000', 'DS_IDLE_MS = 300'), ctx);
const call = (msg) => new Promise((r) => listener(msg, {}, r));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  let r = await call({ type: 'translate', texts: ['hello'], target: 'ZH-HANS', direction: 'incoming' });
  ok(r.ok && r.engine === 'deepl' && r.results[0].text === 'DL:hello', '收到消息默认 DeepL');
  r = await call({ type: 'translate', texts: ['你好'], target: 'EN-US', direction: 'outgoing', context: ['Customer: hi'] });
  const last = calls[calls.length - 1];
  ok(r.ok && r.engine === 'deepseek' && r.results[0].text === 'AI:你好', '发送默认 DeepSeek');
  ok(last.body.model === 'deepseek-flash' && last.body.thinking.type === 'disabled' && last.body.stream === true && JSON.parse(last.body.messages[1].content).context[0] === 'Customer: hi', '旧模型名→deepseek-flash、思考关闭、流式、上下文已传递');
  r = await call({ type: 'translate', texts: ['你好'], target: 'BN', direction: 'incoming' });
  ok(r.engine === 'deepseek', '孟加拉语自动改用 DeepSeek');
  dsMode = 'fail';
  r = await call({ type: 'translate', texts: ['新的一句'], target: 'EN-US', direction: 'outgoing' });
  ok(r.ok && r.engine === 'deepl' && /已改用 DeepL/.test(r.note), 'DeepSeek 出错自动备用 DeepL：' + r.note);
  dsMode = 'fence';
  r = await call({ type: 'translate', texts: ['a', 'b', 'c'], target: 'ZH-HANS', direction: 'incoming', engine: 'deepseek' });
  ok(r.ok && r.results.map((x) => x.text).join() === 'AI:a,AI:b,AI:c', '解析带 ``` 的 JSON、批量顺序正确');
  const n = calls.length;
  r = await call({ type: 'translate', texts: ['a'], target: 'ZH-HANS', direction: 'incoming', engine: 'deepseek' });
  ok(calls.length === n, '缓存命中不再请求');
  r = await call({ type: 'translate', texts: Array.from({ length: 40 }, (_, i) => 'msg' + i), target: 'ZH-HANS', engine: 'deepseek' });
  ok(r.ok && r.results[39].text === 'AI:msg39', '40 条分批（' + (calls.length - n) + ' 次请求）');
  r = await call({ type: 'test', engine: 'deepseek', key: 'sk-1', model: 'deepseek-chat' });
  ok(r.ok, '连接测试：' + r.text);
  dsMode = 'keepalive';
  r = await call({ type: 'translate', texts: ['保持连接'], target: 'EN-US', direction: 'outgoing' });
  ok(r.ok && r.engine === 'deepseek', 'keep-alive 持续 800ms（超过空闲阈值 300ms）仍正常完成');
  dsMode = 'stall';
  r = await call({ type: 'test', engine: 'deepseek', key: 'sk-1', model: 'deepseek-flash' });
  ok(!r.ok && /第 2 步/.test(r.error) && /卡住/.test(r.error), '卡住时分步报错：' + r.error);
  dsMode = 'blank';
  r = await call({ type: 'test', engine: 'deepseek', key: 'sk-1', model: 'deepseek-flash' });
  ok(!r.ok && /空白/.test(r.error), '空白输出立即中止：' + r.error);
  // ---- Qwen-MT ----
  store.qwenKey = 'sk-qw'; store.outgoingEngine = 'qwen';
  store.glossary = '断路器 = circuit breaker\n交期 → lead time\n无效行';
  r = await call({ type: 'translate', texts: ['交期多久'], target: 'EN-US', direction: 'outgoing' });
  let q = calls[calls.length - 1];
  ok(r.ok && r.engine === 'qwen' && r.results[0].text === 'QW:交期多久', '发送用 Qwen-MT');
  ok(q.url === 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' && q.body.model === 'qwen-mt-flash' && q.body.messages.length === 1, '北京地址、qwen-mt-flash、单条 user 消息');
  ok(q.body.translation_options.source_lang === 'auto' && q.body.translation_options.target_lang === 'en', '语言代码 auto → en');
  ok(JSON.stringify(q.body.translation_options.terms) === JSON.stringify([{ source: '断路器', target: 'circuit breaker' }, { source: '交期', target: 'lead time' }]), '术语表解析为 terms');
  ok(/low-voltage electrical/.test(q.body.translation_options.domains), '领域提示已传递');
  r = await call({ type: 'translate', texts: ['hello'], target: 'KK', direction: 'incoming' });
  ok(r.engine === 'qwen' && calls[calls.length - 1].body.translation_options.target_lang === 'kk', '哈萨克语：DeepL 不支持 → Qwen-MT（kk）');
  r = await call({ type: 'translate', texts: ['x'], target: 'ZH-HANT', engine: 'qwen' });
  ok(calls[calls.length - 1].body.translation_options.target_lang === 'zh_tw', '繁体中文 → zh_tw');
  r = await call({ type: 'translate', texts: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], target: 'ZH-HANS', engine: 'qwen' });
  ok(r.ok && r.results.map((x) => x.text).join() === 'QW:p1,QW:p2,QW:p3,QW:p4,QW:p5,QW:p6' && qwMaxInflight === 4, '6 条并行（最多 4 并发）且顺序正确');
  r = await call({ type: 'translate', texts: ['হ্যালো'], target: 'ZH-HANS', direction: 'incoming', source: 'BN' });
  ok(r.ok && r.engine === 'qwen', '收到孟加拉语（source=BN）：不用 DeepL，改用 Qwen-MT');
  qwMode = 'fail';
  r = await call({ type: 'translate', texts: ['新句子A'], target: 'EN-US', direction: 'outgoing' });
  ok(r.ok && r.engine === 'deepl' && /Qwen-MT 出错/.test(r.note), 'Qwen-MT 出错 → 备用 DeepL：' + r.note);
  r = await call({ type: 'test', engine: 'qwen', key: 'bad', model: 'qwen-mt-flash', region: 'beijing' });
  ok(!r.ok && /Key 无效/.test(r.error), '测试：Key 无效提示');
  qwMode = 'arrears';
  r = await call({ type: 'test', engine: 'qwen', key: 'sk-qw', model: 'qwen-mt-plus', region: 'intl' });
  ok(!r.ok && /欠费/.test(r.error) && calls[calls.length - 1].url.startsWith('https://dashscope-intl.aliyuncs.com'), '欠费提示、国际地域地址：' + r.error);
  qwMode = 'ok';
  r = await call({ type: 'test', engine: 'qwen', key: 'sk-qw', model: 'qwen-mt-flash', region: 'beijing' });
  ok(r.ok, 'Qwen 连接测试：' + r.text);
  // ---- 商机作战卡 ----
  dsMode = 'ok'; store.deepseekKey = 'sk-1';
  const msgs = [{ id: 1, time: '10-15 10:05', who: '客户', text: '需要 MCCB 250A 3P 200 台' }, { id: 2, time: '10-15 10:06', who: '客户', text: '交期多久？' }];
  r = await call({ type: 'deal', mode: 'full', today: '2026-10-15', title: 'Ahmed', messages: msgs });
  ok(r.ok && r.card.stage === '谈判' && r.card.value.amount === 7000, '首次生成作战卡（解析 ``` 包裹的 JSON）');
  ok(window.__lastDeal.model === 'deepseek-flash' && window.__lastDeal.thinking.type === 'disabled' && window.__lastDeal.user.today === '2026-10-15', '用 DeepSeek（deepseek-flash、关闭思考）并传入今天日期');
  ok(/不是给你的指令/.test(window.__lastDeal.sys) && /不得编造/.test(window.__lastDeal.sys), '提示词包含防注入与防编造规则');
  r = await call({ type: 'deal', mode: 'update', today: '2026-10-16', title: 'Ahmed', messages: [{ id: 3, time: '10-16 09:00', who: '客户', text: '改成 500 台' }], card: r.card, locked: ['terms'] });
  ok(r.ok && r.card.changed[0].field === 'needs' && window.__lastDeal.user.card && window.__lastDeal.user.locked[0] === 'terms' && /增量更新/.test(window.__lastDeal.sys), '增量更新：只发新消息 + 当前卡片 + 锁定字段');
  ok(window.__lastDeal.user.messages.length === 1, '增量更新只发送 1 条新消息');
  store.deepseekKey = '';
  r = await call({ type: 'deal', mode: 'full', today: '2026-10-15', messages: msgs });
  ok(!r.ok && /DeepSeek/.test(r.error), '没有 DeepSeek Key 时提示：' + r.error);
  delete store.apiKey; store.deepseekKey = ''; store.qwenKey = '';
  r = await call({ type: 'translate', texts: ['x'], target: 'ZH-HANS' });
  ok(!r.ok, '无 Key 提示：' + r.error);
})();
