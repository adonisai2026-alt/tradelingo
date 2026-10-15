(() => {
  const $ = (id) => document.getElementById(id);
  // 作为独立设置页打开时放宽宽度
  if (location.search.includes('page') || window.innerWidth > 600) document.body.classList.add('page');

  function setStatus(id, text, ok) {
    const el = $(id);
    el.textContent = text;
    el.className = 'status' + (ok === undefined ? '' : ok ? ' ok' : ' err');
  }

  function send(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(resp || { ok: false, error: '后台无响应' });
      });
    });
  }

  // 下拉选项
  document.querySelectorAll('select.engine').forEach((sel) => {
    sel.add(new Option('DeepL（速度快）', 'deepl'));
    sel.add(new Option('Qwen-MT（专业翻译）', 'qwen'));
    sel.add(new Option('DeepSeek（懂上下文）', 'deepseek'));
  });
  document.querySelectorAll('select.lang').forEach((sel) => {
    for (const [code, name, , deepl] of WADL_LANGS) sel.add(new Option(deepl ? name : name + '（AI）', code));
  });

  for (const [v, label] of WADL_DS_MODELS) $('deepseekModel').add(new Option(label, v));
  for (const [v, label] of WADL_QWEN_MODELS) $('qwenModel').add(new Option(label, v));

  const CHECKS = ['enabled', 'autoIncoming', 'translateOwn', 'useContext', 'autoChatLang', 'backTranslate'];
  const SELECTS = ['incomingEngine', 'outgoingEngine', 'incomingTarget', 'outgoingTarget', 'formality'];

  const STATUS_IDS = { deepl: 'statusDeepl', qwen: 'statusQwen', deepseek: 'statusDeepseek' };

  async function test(engine) {
    const keyId = WADL_KEY_FIELDS[engine];
    const statusId = STATUS_IDS[engine];
    const key = $(keyId).value.trim();
    let model = '';
    let region = '';
    const patch = { [keyId]: key };
    if (engine === 'deepseek') patch.deepseekModel = model = wadlDsModel($('deepseekModel').value);
    if (engine === 'qwen') {
      patch.qwenModel = model = wadlQwenModel($('qwenModel').value);
      patch.qwenRegion = region = $('qwenRegion').value;
    }
    await chrome.storage.local.set(patch);
    if (!key) { setStatus(statusId, '已清除 API Key'); return; }
    setStatus(statusId, `正在连接 ${WADL_ENGINES[engine]}…`);
    const resp = await send({ type: 'test', engine, key, model, region });
    setStatus(statusId, resp.ok ? '✓ ' + resp.text : '✗ ' + resp.error, resp.ok);
  }

  chrome.storage.local.get(WADL_DEFAULTS).then((s) => {
    $('apiKey').value = s.apiKey;
    $('deepseekKey').value = s.deepseekKey;
    $('qwenKey').value = s.qwenKey;
    $('qwenModel').value = wadlQwenModel(s.qwenModel);
    $('qwenRegion').value = s.qwenRegion || 'beijing';
    const m = wadlDsModel(s.deepseekModel);
    if (![...$('deepseekModel').options].some((o) => o.value === m)) $('deepseekModel').add(new Option(m, m));
    $('deepseekModel').value = m;
    $('glossary').value = s.glossary;
    $('phrases').value = s.phrases;
    CHECKS.forEach((id) => { $(id).checked = s[id]; });
    SELECTS.forEach((id) => { $(id).value = s[id]; });
    if (s.apiKey) test('deepl'); else setStatus('statusDeepl', '未填写');
    if (s.qwenKey) setStatus('statusQwen', '已填写（点“保存并测试”试译一句）');
    else setStatus('statusQwen', '未填写');
    if (s.deepseekKey) setStatus('statusDeepseek', '已填写（点“保存并测试”检查余额）');
    else setStatus('statusDeepseek', '未填写');
  });

  document.querySelectorAll('button.toggle').forEach((b) => b.addEventListener('click', () => {
    const el = $(b.dataset.for);
    el.type = el.type === 'password' ? 'text' : 'password';
  }));
  $('testDeepl').addEventListener('click', () => test('deepl'));
  $('testDeepseek').addEventListener('click', () => test('deepseek'));
  $('testQwen').addEventListener('click', () => test('qwen'));
  $('qwenModel').addEventListener('change', () => chrome.storage.local.set({ qwenModel: $('qwenModel').value }));
  $('qwenRegion').addEventListener('change', () => chrome.storage.local.set({ qwenRegion: $('qwenRegion').value }));
  $('deepseekModel').addEventListener('change', () => chrome.storage.local.set({ deepseekModel: wadlDsModel($('deepseekModel').value) }));

  CHECKS.forEach((id) => $(id).addEventListener('change', () => chrome.storage.local.set({ [id]: $(id).checked })));
  SELECTS.forEach((id) => $(id).addEventListener('change', () => chrome.storage.local.set({ [id]: $(id).value })));

  let gTimer = null;
  $('glossary').addEventListener('input', () => {
    clearTimeout(gTimer);
    gTimer = setTimeout(() => chrome.storage.local.set({ glossary: $('glossary').value }), 800);
  });

  let pTimer = null;
  $('phrases').addEventListener('input', () => {
    clearTimeout(pTimer);
    pTimer = setTimeout(() => chrome.storage.local.set({ phrases: $('phrases').value }), 800);
  });

  $('openDeals').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('deals.html') }));

  $('clearCache').addEventListener('click', async () => {
    const resp = await send({ type: 'clearCache' });
    setStatus('statusCache', resp.ok ? '✓ 缓存已清空' : '✗ ' + resp.error, resp.ok);
  });
})();
