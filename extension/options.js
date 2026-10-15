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

  const CHECKS = ['enabled', 'autoIncoming', 'translateOwn', 'useContext', 'autoChatLang', 'backTranslate', 'notifyEnabled', 'digestEnabled'];
  const SELECTS = ['incomingEngine', 'outgoingEngine', 'incomingTarget', 'outgoingTarget', 'formality', 'notifyWaitHours', 'digestHour'];

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
    SELECTS.forEach((id) => { $(id).value = String(s[id]); });
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
  const NUMERIC = ['notifyWaitHours', 'digestHour'];
  SELECTS.forEach((id) => $(id).addEventListener('change', () => chrome.storage.local.set({ [id]: NUMERIC.includes(id) ? Number($(id).value) : $(id).value })));

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

  // ---------- 提醒 ----------
  $('testNotify').addEventListener('click', async () => {
    const r = await send({ type: 'testNotify' });
    setStatus('statusNotify', r.ok ? '✓ 已发送测试通知，请看屏幕右下角（或通知中心）' : '✗ ' + r.error, r.ok);
  });
  $('checkNow').addEventListener('click', async () => {
    const r = await send({ type: 'checkNow' });
    setStatus('statusNotify', r.ok ? (r.count ? `✓ 已发出 ${r.count} 条提醒` : '✓ 现在没有需要提醒的事项') : '✗ ' + r.error, r.ok);
  });

  // ---------- 备份与恢复 ----------
  const KEY_FIELDS = ['apiKey', 'deepseekKey', 'qwenKey'];
  $('exportBackup').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const settings = {};
    for (const k of Object.keys(WADL_DEFAULTS)) if (k in all && (!KEY_FIELDS.includes(k) || $('backupKeys').checked)) settings[k] = all[k];
    const backup = {
      app: 'TradeLingo', format: 1, version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(),
      includesKeys: $('backupKeys').checked, settings, deals: all.wadlDeals || {}, chatLangs: all.wadlChatLangs || {}
    };
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TradeLingo-备份-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('statusBackup', `✓ 已导出：${Object.keys(backup.deals).length} 张作战卡、${Object.keys(backup.chatLangs).length} 条客户语言记录${backup.includesKeys ? '（含 API Key，请妥善保管）' : ''}`, true);
  });

  // 弹出窗口里选文件会让窗口关闭，所以导入在完整的设置页里进行
  $('importBackup').addEventListener('click', () => {
    if (!document.body.classList.contains('page')) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html?page=1#backup') });
      return;
    }
    $('importFile').click();
  });

  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    let b;
    try { b = JSON.parse(await file.text()); } catch (e) { setStatus('statusBackup', '✗ 文件不是有效的备份（JSON 格式错误）', false); return; }
    if (!b || b.app !== 'TradeLingo' || typeof b.settings !== 'object') { setStatus('statusBackup', '✗ 这不是 TradeLingo 的备份文件', false); return; }
    const cur = await chrome.storage.local.get({ wadlDeals: {}, wadlChatLangs: {} });
    const res = tlMergeBackup(cur, b);
    await chrome.storage.local.set(res.patch);
    setStatus('statusBackup', `✓ 已导入：新增 ${res.dealsAdded} 张、更新 ${res.dealsUpdated} 张作战卡，${res.langs} 条语言记录，${res.settings} 项设置${res.keys ? '（含 API Key）' : ''}`, true);
    setTimeout(() => location.reload(), 1500);
  });

  if (location.hash === '#backup') setTimeout(() => $('backup').scrollIntoView(), 100);

  $('clearCache').addEventListener('click', async () => {
    const resp = await send({ type: 'clearCache' });
    setStatus('statusCache', resp.ok ? '✓ 缓存已清空' : '✗ ' + resp.error, resp.ok);
  });
})();
