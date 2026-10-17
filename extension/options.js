(async () => {
  const $ = (id) => document.getElementById(id);
  // 先确定界面语言，再翻译页面上的固定文字
  tlSetUiLang((await chrome.storage.local.get({ uiLang: 'auto' })).uiLang);
  tlApplyI18n(document.body);
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
        else resolve(resp || { ok: false, error: tr('后台无响应') });
      });
    });
  }

  // 下拉选项
  document.querySelectorAll('select.engine').forEach((sel) => {
    sel.add(new Option(tr('DeepL（速度快）'), 'deepl'));
    sel.add(new Option(tr('Qwen-MT（专业翻译）'), 'qwen'));
    sel.add(new Option(tr('DeepSeek（懂上下文）'), 'deepseek'));
  });
  document.querySelectorAll('select.lang').forEach((sel) => {
    for (const l of WADL_LANGS) sel.add(new Option(tlLangOption(l), l[0]));
  });

  for (const [v, label] of WADL_DS_MODELS) $('deepseekModel').add(new Option(tr(label), v));
  for (const [v, label] of WADL_QWEN_MODELS) $('qwenModel').add(new Option(tr(label), v));

  const CHECKS = ['enabled', 'autoIncoming', 'translateOwn', 'useContext', 'autoChatLang', 'backTranslate', 'notifyEnabled', 'digestEnabled', 'updateCheck', 'notionAuto'];
  const SELECTS = ['incomingEngine', 'outgoingEngine', 'incomingTarget', 'outgoingTarget', 'formality', 'notifyWaitHours', 'digestHour', 'uiLang', 'phraseTrigger'];

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
    if (!key) { setStatus(statusId, tr('已清除 API Key')); return; }
    setStatus(statusId, tr('正在连接 {e}…', { e: WADL_ENGINES[engine] }));
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
    if (s.apiKey) test('deepl'); else setStatus('statusDeepl', tr('未填写'));
    if (s.qwenKey) setStatus('statusQwen', tr('已填写（点“保存并测试”试译一句）'));
    else setStatus('statusQwen', tr('未填写'));
    if (s.deepseekKey) setStatus('statusDeepseek', tr('已填写（点“保存并测试”检查余额）'));
    else setStatus('statusDeepseek', tr('未填写'));
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
  SELECTS.forEach((id) => $(id).addEventListener('change', async () => {
    await chrome.storage.local.set({ [id]: NUMERIC.includes(id) ? Number($(id).value) : $(id).value });
    if (id === 'uiLang') location.reload(); // 换界面语言：重新加载页面
  }));

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
    setStatus('statusNotify', r.ok ? tr('✓ 已发送测试通知，请看屏幕右下角（或通知中心）') : '✗ ' + r.error, r.ok);
  });
  $('checkNow').addEventListener('click', async () => {
    const r = await send({ type: 'checkNow' });
    setStatus('statusNotify', r.ok ? (r.count ? tr('✓ 已发出 {n} 条提醒', { n: r.count }) : tr('✓ 现在没有需要提醒的事项')) : '✗ ' + r.error, r.ok);
  });

  // ---------- 备份与恢复 ----------
  const KEY_FIELDS = ['apiKey', 'deepseekKey', 'qwenKey', 'notionToken'];
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
    a.download = tr('TradeLingo-备份-{d}.json', { d: new Date().toISOString().slice(0, 10) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus('statusBackup', tr('✓ 已导出：{d} 张作战卡、{l} 条客户语言记录', { d: Object.keys(backup.deals).length, l: Object.keys(backup.chatLangs).length }) + (backup.includesKeys ? tr('（含 API Key，请妥善保管）') : ''), true);
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
    try { b = JSON.parse(await file.text()); } catch (e) { setStatus('statusBackup', tr('✗ 文件不是有效的备份（JSON 格式错误）'), false); return; }
    if (!b || b.app !== 'TradeLingo' || typeof b.settings !== 'object') { setStatus('statusBackup', tr('✗ 这不是 TradeLingo 的备份文件'), false); return; }
    const cur = await chrome.storage.local.get({ wadlDeals: {}, wadlChatLangs: {} });
    const res = tlMergeBackup(cur, b);
    await chrome.storage.local.set(res.patch);
    setStatus('statusBackup', tr('✓ 已导入：新增 {a} 张、更新 {u} 张作战卡，{l} 条语言记录，{s} 项设置', { a: res.dealsAdded, u: res.dealsUpdated, l: res.langs, s: res.settings }) + (res.keys ? tr('（含 API Key）') : ''), true);
    setTimeout(() => location.reload(), 1500);
  });

  if (location.hash === '#backup') setTimeout(() => $('backup').scrollIntoView(), 100);

  // ---------- 版本与更新 ----------
  const CUR = chrome.runtime.getManifest().version;
  $('ver').textContent = CUR;
  function showUpdate(u) {
    const has = !!(u && u.latest && wadlVerCmp(u.latest, CUR) > 0);
    $('update').hidden = !has;
    if (!has) return;
    $('updLatest').textContent = 'v' + u.latest;
    $('updDate').textContent = u.date ? tr(' · 新版发布于 {d}', { d: u.date }) : '';
    $('updCurrent').textContent = CUR;
    $('updNotes').textContent = '';
    for (const n of (TL_LANG === 'en' && u.notes_en && u.notes_en.length ? u.notes_en : u.notes) || []) { const li = document.createElement('li'); li.textContent = n; $('updNotes').append(li); }
    $('updDownload').href = u.download || WADL_REPO + '/archive/refs/heads/main.zip';
    $('updChangelog').href = u.changelog || WADL_REPO + '/blob/main/CHANGELOG.md';
  }
  function updateStatus(u) {
    if (!u) { setStatus('statusUpdate', tr('当前版本 v{v}，还没有检查过更新', { v: CUR })); return; }
    const when = u.checkedAt ? new Date(u.checkedAt).toLocaleString(TL_LANG === 'en' ? 'en-GB' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    if (u.error) setStatus('statusUpdate', tr('✗ {e} · {t}。可以稍后再试，或直接到 GitHub 查看', { e: u.error, t: when }), false);
    else if (wadlVerCmp(u.latest, CUR) > 0) setStatus('statusUpdate', tr('有新版本 v{v}（见页面顶部）· 检查于 {t}', { v: u.latest, t: when }), true);
    else setStatus('statusUpdate', tr('✓ 已是最新版本 v{v} · 检查于 {t}', { v: CUR, t: when }), true);
  }
  chrome.storage.local.get({ wadlUpdate: null }).then(({ wadlUpdate }) => { showUpdate(wadlUpdate); updateStatus(wadlUpdate); });
  $('checkUpdate').addEventListener('click', async () => {
    setStatus('statusUpdate', tr('正在检查…'));
    const r = await send({ type: 'checkUpdate' });
    if (!r.ok) { setStatus('statusUpdate', '✗ ' + r.error, false); return; }
    showUpdate(r.info); updateStatus(r.info);
  });
  if (location.hash === '#update') setTimeout(() => { $('updHow').open = true; }, 100);

  // ---------- Notion 同步 ----------
  const NOTION_ORIGIN = 'https://api.notion.com/*';
  const fmtTime = (t) => new Date(t).toLocaleString(TL_LANG === 'en' ? 'en-GB' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  function askNotionPermission() {
    return new Promise((resolve) => {
      try {
        if (!chrome.permissions) return resolve(true);
        chrome.permissions.request({ origins: [NOTION_ORIGIN] }, (ok) => resolve(!!ok && !chrome.runtime.lastError));
      } catch (e) { resolve(false); }
    });
  }
  function showNotionStatus(sync) {
    if (!sync || !sync.lastAt) return;
    const n = Object.keys(sync.map || {}).length;
    if (sync.error) setStatus('statusNotion', tr('✗ {e}（{t}）', { e: sync.error, t: fmtTime(sync.lastAt) }), false);
    else setStatus('statusNotion', tr('✓ 上次同步 {t}：Notion 里共有 {n} 个客户', { t: fmtTime(sync.lastAt), n }) + (sync.skipped && sync.skipped.length ? tr('；已跳过被删除或改名的列：{x}', { x: sync.skipped.join(tr('、')) }) : ''), true);
  }
  async function renderNotion() {
    const st = await chrome.storage.local.get({ wadlNotion: null, wadlNotionSync: null, notionToken: '' });
    const cfg = st.wadlNotion;
    $('nConnected').hidden = !cfg;
    $('nSetup').hidden = !!cfg;
    $('notionToken').value = st.notionToken || '';
    if (cfg) {
      const a = document.createElement('a');
      a.href = cfg.url || 'https://www.notion.so/';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = tr('已连接：{x} ↗', { x: cfg.title || tr('TradeLingo 商机') });
      $('nDbLink').textContent = '';
      $('nDbLink').append(a);
      showNotionStatus(st.wadlNotionSync);
    }
  }
  $('nConnect').addEventListener('click', async () => {
    // 弹出窗口里请求权限时窗口可能被关闭，所以在完整设置页里进行
    const token = $('notionToken').value.trim();
    if (!document.body.classList.contains('page')) {
      if (token) await chrome.storage.local.set({ notionToken: token });
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html?page=1#notion') });
      return;
    }
    if (!token) { setStatus('statusNotion', tr('请先粘贴 Notion 连接密钥'), false); return; }
    if (!(await askNotionPermission())) { setStatus('statusNotion', tr('✗ 需要允许插件访问 api.notion.com 才能同步'), false); return; }
    await chrome.storage.local.set({ notionToken: token });
    setStatus('statusNotion', tr('正在连接 Notion…'));
    const r = await send({ type: 'notionList', token });
    if (!r.ok) { setStatus('statusNotion', '✗ ' + r.error, false); return; }
    $('nPage').textContent = '';
    for (const p of r.pages) $('nPage').add(new Option(p.title, p.id));
    $('nDb').textContent = '';
    const ours = r.dbs.filter((d) => d.ours);
    for (const d of ours) $('nDb').add(new Option(d.title, d.id));
    $('nUseRow').hidden = !ours.length;
    $('nPick').hidden = false;
    $('nCreate').disabled = !r.pages.length;
    if (!r.pages.length && !ours.length) setStatus('statusNotion', tr('✓ 密钥有效，但这个连接还看不到任何页面：请在 Notion 连接设置的“内容访问权限”里添加一个页面，然后再点一次“连接 Notion”'), false);
    else setStatus('statusNotion', tr('✓ 已连接。选择一个页面，点“创建数据库”'), true);
  });
  const afterSetup = async (r) => {
    if (!r.ok) { setStatus('statusNotion', '✗ ' + r.error, false); return; }
    await renderNotion();
    const x = r.result;
    if (x && x.error) setStatus('statusNotion', '✗ ' + x.error, false);
    else setStatus('statusNotion', tr('✓ 数据库已就绪，已同步 {n} 个客户', { n: x ? x.done : 0 }), true);
  };
  $('nCreate').addEventListener('click', async () => {
    if (!$('nPage').value) return;
    setStatus('statusNotion', tr('正在创建数据库并同步…'));
    afterSetup(await send({ type: 'notionCreateDb', pageId: $('nPage').value }));
  });
  $('nUse').addEventListener('click', async () => {
    setStatus('statusNotion', tr('正在检查数据库并同步…'));
    afterSetup(await send({ type: 'notionUseDb', dbId: $('nDb').value }));
  });
  $('nSync').addEventListener('click', async () => {
    if (!(await askNotionPermission())) { setStatus('statusNotion', tr('✗ 需要允许插件访问 api.notion.com 才能同步'), false); return; }
    setStatus('statusNotion', tr('正在同步…'));
    const r = await send({ type: 'notionSyncNow' });
    if (!r.ok) setStatus('statusNotion', '✗ ' + r.error, false);
    else if (r.error) setStatus('statusNotion', tr('✗ 同步了 {d} 个，{f} 个失败：{e}', { d: r.done, f: r.failed, e: r.error }), false);
    else setStatus('statusNotion', tr('✓ 已同步 {d} 个客户', { d: r.done }), true);
  });
  $('nDisconnect').addEventListener('click', async () => {
    if (!window.confirm(tr('断开后插件不再写入 Notion；Notion 里已有的数据不会删除。确定吗？'))) return;
    await send({ type: 'notionDisconnect' });
    renderNotion();
    setStatus('statusNotion', tr('已断开。Notion 里的数据仍然保留。'));
  });
  renderNotion();
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.wadlNotionSync) showNotionStatus(ch.wadlNotionSync.newValue); });
  if (location.hash === '#notion') setTimeout(() => $('notion').scrollIntoView(), 100);

  // ---------- 使用向导 ----------
  const openWelcome = () => chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  $('openWelcome').addEventListener('click', openWelcome);
  $('openWelcome2').addEventListener('click', openWelcome);
  chrome.storage.local.get({ apiKey: '', qwenKey: '', deepseekKey: '' }).then((k) => { $('welcomeCard').hidden = !!(k.apiKey || k.qwenKey || k.deepseekKey); });

  // ---------- 本月用量 ----------
  function showUsage(u) {
    const box = $('usage');
    box.textContent = '';
    const m = tlTodayStr().slice(0, 7);
    const cur = u && u.month === m ? u : {};
    $('usageMonth').textContent = m;
    const rows = [['DeepL', cur.deepl], [tr('通义千问 Qwen-MT'), cur.qwen], [tr('DeepSeek 翻译'), cur.deepseek], [tr('DeepSeek 商机作战卡'), cur.deal]];
    for (const [name, n] of rows) {
      const a = document.createElement('span'); a.textContent = name;
      const b = document.createElement('b'); b.textContent = tr('{n} 字符', { n: (n || 0).toLocaleString('en-US') });
      box.append(a, b);
    }
    const prev = cur.prev || (u && u.month && u.month !== m ? u : null);
    if (prev && prev.month) {
      const total = (prev.deepl || 0) + (prev.qwen || 0) + (prev.deepseek || 0) + (prev.deal || 0);
      const a = document.createElement('span'); a.className = 'hint'; a.textContent = tr('上月（{m}）合计', { m: prev.month });
      const b = document.createElement('b'); b.className = 'hint'; b.textContent = tr('{n} 字符', { n: total.toLocaleString('en-US') });
      box.append(a, b);
    }
  }
  chrome.storage.local.get({ wadlUsage: null }).then(({ wadlUsage }) => showUsage(wadlUsage));
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.wadlUsage) showUsage(ch.wadlUsage.newValue);
    if (ch.wadlUpdate) { showUpdate(ch.wadlUpdate.newValue); updateStatus(ch.wadlUpdate.newValue); }
  });

  $('clearCache').addEventListener('click', async () => {
    const resp = await send({ type: 'clearCache' });
    setStatus('statusCache', resp.ok ? tr('✓ 缓存已清空') : '✗ ' + resp.error, resp.ok);
  });
})();
