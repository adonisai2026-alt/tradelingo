// TradeLingo — 首次使用向导：选引擎 → 填 Key 并测试 → 设置语言 → 完成
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY_FIELD = { deepl: 'apiKey', qwen: 'qwenKey', deepseek: 'deepseekKey' };
  const GUIDE = {
    qwen: {
      title: '获取通义千问 Qwen-MT 的 API Key',
      placeholder: '粘贴以 sk- 开头的 Key',
      how: [
        '打开 <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener">阿里云百炼控制台</a>，用阿里云账号登录（没有账号可以用手机号或支付宝注册，并按提示完成实名认证）。',
        '第一次进入时，按页面提示开通百炼服务（按用量付费，不用的话不收费）。',
        '在控制台找到 <b>API-KEY</b>（密钥管理）页面，点 <b>创建 API-KEY</b>，复制以 sk- 开头的 Key。',
        '粘贴到下面，地域选 <b>北京</b>（如果你是在阿里云国际站创建的 Key，选“新加坡”），然后点“保存并测试”。'
      ],
      note: '账户欠费时翻译会停止，记得在阿里云费用中心留一点余额。'
    },
    deepl: {
      title: '获取 DeepL 的 API Key',
      placeholder: '粘贴 DeepL Key（免费版以 :fx 结尾）',
      how: [
        '打开 <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener">DeepL API 页面</a>，选择 <b>DeepL API Free</b>（免费版）注册。',
        '按提示填写信用卡做身份验证（免费版不会扣费）。需要 DeepL 支持的国家/地区发行的卡，国内不少卡会失败。',
        '登录后进入 <b>账户（Account）→ API Keys</b>，复制 Key。',
        '粘贴到下面，点“保存并测试”。'
      ],
      note: 'DeepL 不支持孟加拉语、哈萨克语、越南语、泰语等。遇到这些客户时，插件需要通义千问或 DeepSeek 的 Key 才能翻译，以后可以在设置页补上。'
    },
    deepseek: {
      title: '获取 DeepSeek 的 API Key',
      placeholder: '粘贴以 sk- 开头的 Key',
      how: [
        '打开 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener">DeepSeek 开放平台</a>，用手机号注册登录。',
        '在 <b>充值</b> 页面先充一点余额（按用量计费，余额为 0 时无法调用）。',
        '进入 <b>API keys</b> 页面，点 <b>创建 API key</b>，复制以 sk- 开头的 Key（只显示一次，请马上保存）。',
        '粘贴到下面，点“保存并测试”，会同时显示账户余额。'
      ],
      note: ''
    }
  };

  let engine = 'qwen';
  let tested = false;
  let step = 1;

  function send(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r || { ok: false, error: '后台无响应' }));
    });
  }

  function go(n) {
    step = n;
    for (let i = 1; i <= 4; i++) $('s' + i).hidden = i !== n;
    [...$('steps').children].forEach((d, i) => { d.className = i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''; });
    window.scrollTo(0, 0);
  }

  // ---------- 1 ----------
  document.querySelectorAll('#engines .opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      engine = opt.dataset.e;
      document.querySelectorAll('#engines .opt').forEach((o) => o.classList.toggle('on', o === opt));
      opt.querySelector('input').checked = true;
    });
  });

  async function fillStep2() {
    const g = GUIDE[engine];
    $('kTitle').textContent = g.title;
    $('kHow').innerHTML = g.how.map((x) => `<li>${x}</li>`).join(''); // 固定文案，非用户输入
    $('key').placeholder = g.placeholder;
    $('region').hidden = engine !== 'qwen';
    $('kNote').hidden = !g.note;
    $('kNote').textContent = g.note;
    const s = await chrome.storage.local.get(WADL_DEFAULTS);
    $('key').value = s[KEY_FIELD[engine]] || '';
    $('region').value = s.qwenRegion || 'beijing';
    tested = false;
    $('to3').disabled = true;
    $('kStatus').textContent = $('key').value ? '已填写过 Key，点“保存并测试”确认一下' : '';
    $('kStatus').className = 'status';
  }

  $('to2').addEventListener('click', async () => { await fillStep2(); go(2); });

  // ---------- 2 ----------
  $('key').addEventListener('input', () => { tested = false; $('to3').disabled = true; });
  $('test').addEventListener('click', async () => {
    const key = $('key').value.trim();
    if (!key) { $('kStatus').textContent = '请先粘贴 Key'; $('kStatus').className = 'status err'; return; }
    if (engine === 'deepl' && /^sk-/.test(key)) { $('kStatus').textContent = '这看起来是通义千问或 DeepSeek 的 Key（以 sk- 开头），不是 DeepL 的。请返回上一步选对引擎。'; $('kStatus').className = 'status err'; return; }
    const patch = { [KEY_FIELD[engine]]: key };
    if (engine === 'qwen') patch.qwenRegion = $('region').value;
    await chrome.storage.local.set(patch);
    $('test').disabled = true;
    $('kStatus').textContent = '正在连接，最多需要十几秒…';
    $('kStatus').className = 'status';
    const s = await chrome.storage.local.get(WADL_DEFAULTS);
    const model = engine === 'qwen' ? wadlQwenModel(s.qwenModel) : engine === 'deepseek' ? wadlDsModel(s.deepseekModel) : '';
    const r = await send({ type: 'test', engine, key, model, region: engine === 'qwen' ? $('region').value : '' });
    $('test').disabled = false;
    tested = !!r.ok;
    $('to3').disabled = !tested;
    let msg = r.ok ? '✓ ' + r.text : '✗ ' + r.error;
    if (!r.ok && engine === 'qwen' && /无效/.test(r.error)) msg += '。请确认 Key 复制完整，并检查地域选得对不对。';
    $('kStatus').textContent = msg;
    $('kStatus').className = 'status ' + (r.ok ? 'ok' : 'err');
  });
  $('back1').addEventListener('click', () => go(1));
  $('skip2').addEventListener('click', () => go(3));
  $('to3').addEventListener('click', () => go(3));

  // ---------- 3 ----------
  for (const [code, name, , deepl] of WADL_LANGS) {
    $('inT').add(new Option(name, code));
    $('outT').add(new Option(deepl ? name : name + '（AI）', code));
  }
  chrome.storage.local.get(WADL_DEFAULTS).then((s) => { $('inT').value = s.incomingTarget; $('outT').value = s.outgoingTarget; });
  $('back2').addEventListener('click', () => go(2));

  $('to4').addEventListener('click', async () => {
    const s = await chrome.storage.local.get(WADL_DEFAULTS);
    const has = { deepl: !!s.apiKey.trim(), qwen: !!s.qwenKey.trim(), deepseek: !!s.deepseekKey.trim() };
    // 只用已经填了 Key 的引擎，避免每次都先失败再切换
    const pick = (prefer) => prefer.find((e) => has[e]) || s.incomingEngine;
    await chrome.storage.local.set({
      incomingTarget: $('inT').value,
      outgoingTarget: $('outT').value,
      incomingEngine: pick(['deepl', 'qwen', 'deepseek']),
      outgoingEngine: pick(['qwen', 'deepl', 'deepseek']),
      wadlWelcomeDone: true
    });
    go(4);
  });

  // 显示 DeepSeek 提示
  const refreshDsNote = () => chrome.storage.local.get({ deepseekKey: '' }).then((k) => { $('dsNote').hidden = !!k.deepseekKey.trim(); });
  $('to3').addEventListener('click', refreshDsNote);
  $('skip2').addEventListener('click', refreshDsNote);

  // ---------- 4 ----------
  $('openWA').addEventListener('click', () => chrome.tabs.create({ url: 'https://web.whatsapp.com/' }));
  $('openOpts').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('options.html?page=1') }));

  go(1);
})();
