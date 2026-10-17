// TradeLingo — 注入 WhatsApp Web：自动翻译消息 + 输入框一键翻译
// v0.10.1：“话”按钮常驻、图片说明框翻译、话术触发键可选 / 或 ;；v0.10.0：Notion 同步；v0.9.0：英文界面、WhatsApp 改版预警；v0.8.0：首次使用向导、新版本提醒、本月用量；v0.7.1：读取聊天列表未读，补上提醒盲区；v0.7.0：跟进提醒、每日早报、备份与恢复；v0.6.0：新增商机作战卡（DeepSeek）与今日跟进；v0.5.0：项目更名为 TradeLingo 并开源；v0.4.3：加固聊天识别和收发方向判断，诊断信息加入语言识别；v0.4.2：修复 Lexical 输入框中译文被追加到原文后面；v0.4.1：DeepL 不支持的语言收到时自动改用 AI；v0.4.0：按聊天记住客户语言、回译校对、快捷话术；v0.3.0：新增 Qwen-MT 引擎，三引擎轮换；v0.2.0：新增 DeepSeek AI 翻译、双引擎切换与自动备用；v0.1.2：修复引用回复时误译引用内容；v0.1.1：不再依赖 #main / footer / .message-in 等易变结构，改为多重兜底识别；新增 Alt+Shift+D 诊断
(() => {
  'use strict';
  const VERSION = '0.10.1';
  console.info(`[TradeLingo] v${VERSION} 已加载`);

  let settings = { ...WADL_DEFAULTS };
  tlSetUiLang(settings.uiLang);
  let lastOriginal = null;

  // ---------- 与后台通信 ----------
  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: tr('插件已更新或重载，请刷新 WhatsApp 页面') });
          else resolve(resp || { ok: false, error: tr('后台无响应') });
        });
      } catch (e) {
        resolve({ ok: false, error: tr('插件已更新或重载，请刷新 WhatsApp 页面') });
      }
    });
  }

  // ---------- 工具函数 ----------
  const NO_WORDS_RE = /^[\s\d\p{P}\p{S}]*$/u;
  const URL_ONLY_RE = /^https?:\/\/\S+$/i;
  const TIME_RE = /^\d{1,2}:\d{2}(\s?[AaPp][Mm])?$/;
  const HAN_RE = /\p{Script=Han}/gu;
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function shouldSkip(text, target) {
    if (NO_WORDS_RE.test(text) || URL_ONLY_RE.test(text)) return true;
    if (target.startsWith('ZH')) {
      const han = (text.match(HAN_RE) || []).length;
      const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '').length;
      if (letters > 0 && han / letters > 0.5) return true;
    }
    return false;
  }

  // 用户自己的语言（收到的消息译成什么语言），如 ZH / EN
  const myBase = () => (settings.incomingTarget || 'ZH-HANS').split('-')[0].toUpperCase();
  const isMine = (code) => (code || '').split('-')[0].toUpperCase() === myBase();

  function sameLang(detected, target) {
    if (!detected) return false;
    return detected.split('-')[0].toUpperCase() === target.split('-')[0].toUpperCase();
  }

  function toast(text, isErr) {
    let t = document.getElementById('wadl-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'wadl-toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.toggle('wadl-err', !!isErr);
    t.classList.add('wadl-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('wadl-show'), 4000);
  }

  const isOurs = (el) => !!el.closest('.wadl-tr, #wadl-bar, #wadl-toast, #wadl-back, #wadl-phrases, #tl-health, #tl-deal');

  // ---------- 消息识别（多重兜底） ----------
  // 引用框（回复他人消息时上方那块）：可点击跳转，带 quoted-mention 类或 "Quoted" 标签
  function inQuote(el, root) {
    if (el.closest('.quoted-mention')) return true;
    const btn = el.closest('[role="button"], [aria-label*="uoted"], [aria-label*="引用"]');
    return !!(btn && root.contains(btn) && btn !== root);
  }

  function pickText(root) {
    // 取最后一个不在引用框里的正文（引用在前，正文在后）
    const sels = [...root.querySelectorAll('.selectable-text')].filter(
      (s) => !isOurs(s) && !inQuote(s, root) && !(s.parentElement && s.parentElement.closest('.selectable-text')) && norm(s.innerText)
    );
    if (sels.length) return sels[sels.length - 1];
    // 兜底：最外层的 span[dir]，排除时间和引用，取最后一个
    const cands = [...root.querySelectorAll('span[dir]')].filter((s) => {
      if (isOurs(s) || inQuote(s, root)) return false;
      if (s.parentElement && s.parentElement.closest('span[dir]') && root.contains(s.parentElement.closest('span[dir]'))) return false;
      const t = norm(s.innerText);
      return t && !TIME_RE.test(t);
    });
    return cands.length ? cands[cands.length - 1] : null;
  }

  // 判断是不是自己发出的消息：依次用 类名 → data-id 前缀 → 气泡尾巴/勾号图标 → 气泡在左还是在右
  let dirSource = '';
  function isOutgoing(el) {
    if (el.closest('.message-out')) { dirSource = 'class'; return true; }
    if (el.closest('.message-in')) { dirSource = 'class'; return false; }
    const row = el.closest('[data-id]');
    const id = (row && row.dataset.id) || '';
    if (/^true_/.test(id)) { dirSource = 'data-id'; return true; }
    if (/^false_/.test(id)) { dirSource = 'data-id'; return false; }
    const scope = el.closest('[role="row"]') || row || el.parentElement;
    if (scope) {
      if (scope.querySelector('[data-icon="tail-out"], [data-icon^="msg-check"], [data-icon^="msg-dblcheck"], [data-icon="msg-time"]')) { dirSource = 'icon'; return true; }
      if (scope.querySelector('[data-icon="tail-in"]')) { dirSource = 'icon'; return false; }
    }
    // 最后按位置：自己的消息靠右
    const input = getInput();
    const area = (input && input.getBoundingClientRect()) || document.body.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    dirSource = 'position';
    return r.left - area.left > area.right - r.right;
  }

  function findMessages() {
    const out = [];
    const pre = document.querySelectorAll('[data-pre-plain-text]');
    if (pre.length) {
      for (const c of pre) {
        if (isOurs(c)) continue;
        const textEl = pickText(c);
        if (textEl) out.push({ container: c, textEl, isOut: isOutgoing(c) });
      }
      return out;
    }
    // 兜底：消息行 data-id 以 true_/false_ 开头
    for (const row of document.querySelectorAll('[data-id]')) {
      if (row.querySelector('[data-id]') || isOurs(row)) continue; // 只取最内层
      const textEl = pickText(row);
      if (textEl) out.push({ container: textEl.parentElement, textEl, isOut: isOutgoing(textEl) });
    }
    return out;
  }

  // ---------- 按聊天记住客户语言 ----------
  // 聊天 ID 取自消息行 data-id（形如 false_<聊天ID>@c.us_<消息ID>），只保存其哈希，不保存号码
  const strHash = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.codePointAt(0)) | 0; return 'c' + (h >>> 0).toString(36); };

  // data-id 里通常含有聊天 ID（xxx@c.us / xxx@g.us / xxx@lid），群聊时第一个是群 ID
  const JID_RE = /([0-9A-Za-z.\-]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|broadcast|newsletter))/;
  function chatIdFromRow(row) {
    const id = row && row.dataset && row.dataset.id;
    const m = id && id.match(JID_RE);
    return m ? m[1] : '';
  }

  // 聊天顶部的联系人名称（只取第一行名称，不取“在线 / 正在输入… / 最后上线”那一行）
  function headerName() {
    const input = getInput();
    let header = document.querySelector('#main header');
    if (!header && input) {
      const ir = input.getBoundingClientRect();
      header = [...document.querySelectorAll('header')].find((h) => {
        const r = h.getBoundingClientRect();
        return r.width > 0 && r.right > ir.left && r.left < ir.right && r.top < ir.top;
      });
    }
    if (!header) return '';
    const spans = [...header.querySelectorAll('span[dir="auto"]')].filter((x) => !x.querySelector('span[dir="auto"]'));
    const first = spans.find((x) => norm(x.textContent));
    return first ? norm(first.textContent) : '';
  }

  let chatSource = '';
  function currentChatKey() {
    const rows = document.querySelectorAll('[data-id]');
    for (let i = rows.length - 1; i >= 0; i--) {
      if (isOurs(rows[i])) continue;
      const id = chatIdFromRow(rows[i]);
      if (id) { chatSource = 'data-id'; return strHash(id); }
    }
    const name = headerName();
    chatSource = name ? 'header' : 'none';
    return name ? strHash('name:' + name) : '';
  }

  function chatKeyFor(el) {
    const id = chatIdFromRow(el.closest('[data-id]'));
    return id ? strHash(id) : currentChatKey();
  }

  let chatLangs = {};      // 聊天 → { l: 语言代码, m: 是否手动, t: 时间 }
  const chatVotes = {};    // 聊天 → { 语言: 得分 }（本次打开页面期间的统计）
  let chatSaveTimer = null;
  function saveChatLangs() {
    clearTimeout(chatSaveTimer);
    chatSaveTimer = setTimeout(() => {
      const keys = Object.keys(chatLangs);
      if (keys.length > 1000) {
        keys.sort((a, b) => (chatLangs[a].t || 0) - (chatLangs[b].t || 0)).slice(0, keys.length - 1000).forEach((k) => delete chatLangs[k]);
      }
      chrome.storage.local.set({ wadlChatLangs: chatLangs });
    }, 800);
  }

  // 按文字本身判断（非拉丁文字更可靠，也能区分哈萨克语/俄语、乌尔都语/阿拉伯语）
  function scriptLang(text) {
    if (/\p{Script=Bengali}/u.test(text)) return 'BN';
    if (/\p{Script=Thai}/u.test(text)) return 'TH';
    if (/\p{Script=Hangul}/u.test(text)) return 'KO';
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'JA';
    if (/\p{Script=Devanagari}/u.test(text)) return 'HI';
    if (/\p{Script=Arabic}/u.test(text)) {
      if (/[ٹڈڑںےھ]/.test(text)) return 'UR';
      if (/[پچژگ]/.test(text)) return 'FA';
      return 'AR';
    }
    if (/\p{Script=Cyrillic}/u.test(text)) {
      if (/[әғқңөұүһӘҒҚҢӨҰҮҺ]/.test(text)) return 'KK';
      if (/[їєґЇЄҐ]/.test(text)) return 'UK';
      return 'RU';
    }
    return '';
  }

  // 识别结果 → 发送目标语言代码
  function toTarget(code) {
    const base = (code || '').toUpperCase().replace('_', '-').split('-')[0];
    if (!base || base === 'ZH' || base === myBase()) return '';
    const def = settings.outgoingTarget || 'EN-US';
    if (base === 'EN') return def.startsWith('EN') ? def : 'EN-US';
    if (base === 'PT') return def.startsWith('PT') ? def : 'PT-BR';
    if (base === 'TL' || base === 'FIL') return 'FIL';
    const hit = WADL_LANGS.find((l) => l[0] === base);
    return hit ? hit[0] : '';
  }

  // ---- 按聊天识别语言：用 Chrome 自带的语言识别（不依赖翻译引擎、不耗额度）----
  // 每条可见消息识别一次：客户发来的权重 ×3，自己发出的外语消息权重 ×1（客户还没回复时也能判断）
  const msgLangs = {};     // 聊天 → { 消息键: { l: 语言, w: 权重 } }
  const detectCache = new Map();

  function cldDetect(text) {
    return new Promise((resolve) => {
      try {
        if (!(chrome.i18n && chrome.i18n.detectLanguage)) return resolve('');
        chrome.i18n.detectLanguage(text, (r) => {
          const best = r && r.languages && r.languages[0];
          if (!best || (!r.isReliable && text.length < 25)) return resolve('');
          resolve(best.language || '');
        });
      } catch (e) { resolve(''); }
    });
  }

  async function detectLang(text) {
    const t = norm(text);
    if (detectCache.has(t)) return detectCache.get(t);
    // 非拉丁文字先按字母特征判断（能区分哈萨克语/俄语、乌尔都语/阿拉伯语）
    let lang = toTarget(scriptLang(t));
    if (!lang && t.replace(/[\s\d\p{P}\p{S}]/gu, '').length >= 4) lang = toTarget(await cldDetect(t));
    detectCache.set(t, lang);
    return lang;
  }

  function recomputeChat(chat) {
    if (!chat || !settings.autoChatLang) return;
    const v = {};
    for (const { l, w } of Object.values(msgLangs[chat] || {})) if (l) v[l] = (v[l] || 0) + w;
    chatVotes[chat] = v;
    const top = Object.keys(v).sort((a, b) => v[b] - v[a])[0];
    const rec = chatLangs[chat];
    if (!top || (rec && rec.m)) return;
    if (!rec || rec.l !== top) {
      chatLangs[chat] = { l: top, m: false, t: Date.now() };
      saveChatLangs();
      updateBar();
    }
  }

  async function learnMessage(chat, text, isOut, engineDetected) {
    if (!chat || !settings.autoChatLang) return;
    const t = norm(text);
    if (!t) return;
    const key = (isOut ? 'o|' : 'i|') + t;
    const store = (msgLangs[chat] = msgLangs[chat] || {});
    if (store[key] && store[key].l) return;
    let lang = await detectLang(t);
    if (!lang && engineDetected && t.length >= 8) lang = toTarget(engineDetected); // 备用：翻译引擎返回的语言
    store[key] = { l: lang, w: Math.min(3, 1 + Math.floor(t.length / 40)) * (isOut ? 1 : 3) };
    recomputeChat(chat);
  }

  function voteLang(chat, text, detected) { learnMessage(chat, text, false, detected); }

  // 当前聊天的发送语言：{ lang, mode: 'manual' | 'auto' | 'default', chat }
  function currentTarget() {
    const chat = currentChatKey();
    const rec = chat && chatLangs[chat];
    if (rec && (rec.m || settings.autoChatLang)) return { lang: rec.l, mode: rec.m ? 'manual' : 'auto', chat };
    return { lang: settings.outgoingTarget, mode: 'default', chat };
  }

  // ---------- 收到的消息：自动翻译 ----------
  let queue = [];
  let flushTimer = null;

  const engineName = (e) => WADL_ENGINES[e] || e;
  // 已填写 Key 的引擎，按固定顺序轮换
  const ENGINE_CYCLE = ['deepl', 'qwen', 'deepseek'];
  const availableEngines = () => ENGINE_CYCLE.filter((e) => (settings[WADL_KEY_FIELDS[e]] || '').trim());
  function otherEngine(e) {
    const av = availableEngines().filter((x) => x !== e);
    if (!av.length) return null;
    const start = ENGINE_CYCLE.indexOf(e);
    for (let k = 1; k <= ENGINE_CYCLE.length; k++) {
      const c = ENGINE_CYCLE[(start + k) % ENGINE_CYCLE.length];
      if (av.includes(c)) return c;
    }
    return av[0];
  }

  // 引擎回退提示（30 秒内只提示一次，避免刷屏）
  let lastNoteAt = 0;
  function showNote(note) {
    if (!note || Date.now() - lastNoteAt < 30000) return;
    lastNoteAt = Date.now();
    toast(note);
  }

  // state: loading / ok / error；info: { engine, source }
  function renderTr(container, text, state, info = {}) {
    let el = container.querySelector(':scope > .wadl-tr');
    if (!el) {
      el = document.createElement('div');
      container.appendChild(el);
    }
    el.className = 'wadl-tr' + (state === 'loading' ? ' wadl-loading' : state === 'error' ? ' wadl-err' : '');
    el.textContent = '';
    const body = document.createElement('span');
    body.className = 'wadl-text';
    body.textContent = state === 'error' ? `⚠ ${text}${tr('（点击重试）')}` : text;
    el.appendChild(body);
    el.onclick = null;

    if (state === 'error') {
      el.onclick = (e) => { e.stopPropagation(); el.remove(); delete container.dataset.wadlSrc; scan(); };
    } else if (state === 'ok' && info.engine) {
      const meta = document.createElement('span');
      meta.className = 'wadl-meta';
      const tag = document.createElement('span');
      tag.className = 'wadl-tag wadl-tag-' + info.engine;
      tag.textContent = WADL_ENGINE_TAGS[info.engine] || info.engine;
      meta.appendChild(tag);
      const alt = otherEngine(info.engine);
      if (alt) {
        const swap = document.createElement('button');
        swap.className = 'wadl-swap';
        swap.textContent = '⇄';
        swap.title = tr('用 {e} 重新翻译', { e: engineName(alt) });
        swap.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
        swap.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          retranslate(container, info.source, alt);
        });
        meta.appendChild(swap);
      }
      el.appendChild(meta);
    }
  }

  async function retranslate(container, text, engine) {
    const target = settings.incomingTarget;
    renderTr(container, tr('正在用 {e} 重新翻译…', { e: engineName(engine) }), 'loading');
    const sl = scriptLang(text);
    const l = sl && WADL_LANGS.find((x) => x[0] === sl);
    const resp = await send({ type: 'translate', texts: [text], target, direction: 'incoming', engine, source: l && !l[3] ? sl : undefined });
    if (!container.isConnected) return;
    if (!resp.ok) { renderTr(container, resp.error, 'error'); return; }
    showNote(resp.note);
    renderTr(container, resp.results[0].text, 'ok', { engine: resp.engine, source: text });
  }

  function removeTr(container) {
    const el = container.querySelector(':scope > .wadl-tr');
    if (el) el.remove();
  }

  function enqueue(item) {
    queue.push(item);
    renderTr(item.container, tr('翻译中…'), 'loading');
    if (!flushTimer) flushTimer = setTimeout(flush, 250);
  }

  async function flush() {
    flushTimer = null;
    const batch = queue.splice(0, 50);
    if (queue.length) flushTimer = setTimeout(flush, 250);
    if (!batch.length) return;

    const target = settings.incomingTarget;
    // 按文字识别出的语言分组：DeepL 不认识的语言（孟加拉语、哈萨克语等）带上 source，后台会改用 AI 引擎
    const groups = {};
    for (const b of batch) {
      const sl = scriptLang(b.text);
      const l = sl && WADL_LANGS.find((x) => x[0] === sl);
      const src = l && !l[3] ? sl : '';
      (groups[src] = groups[src] || []).push(b);
    }
    for (const src of Object.keys(groups)) await flushGroup(groups[src], src, target);
  }

  async function flushGroup(batch, src, target) {
    const resp = await send({ type: 'translate', texts: batch.map((b) => b.text), target, direction: 'incoming', source: src || undefined });
    if (resp.ok && !src) showNote(resp.note);
    batch.forEach((b, i) => {
      if (!b.container.isConnected) return;
      if (resp.ok) {
        const r = resp.results[i];
        if (!b.isOut) voteLang(b.chat, b.text, r.detected);
        if (sameLang(r.detected, target) || norm(r.text) === norm(b.text)) removeTr(b.container);
        else renderTr(b.container, r.text, 'ok', { engine: resp.engine, source: b.text });
      } else {
        renderTr(b.container, resp.error, 'error');
      }
    });
  }

  let lastFound = -1;
  function scan() {
    if (!settings.enabled) return;

    const target = settings.incomingTarget;
    const msgs = findMessages();
    if (msgs.length !== lastFound) {
      lastFound = msgs.length;
      console.debug(`[WADL] 识别到 ${msgs.length} 条消息`);
    }
    if (settings.autoChatLang && msgs.length) {
      const chat = currentChatKey();
      for (const { textEl, isOut } of msgs.slice(-40)) learnMessage(chat, textEl.innerText || '', isOut);
    }
    for (const { container, textEl, isOut } of msgs) {
      if (isOut ? !settings.translateOwn : !settings.autoIncoming) continue;
      const text = (textEl.innerText || '').trim();
      const sig = target + '|' + text;
      if (container.dataset.wadlSrc === sig) continue;

      container.dataset.wadlSrc = sig;
      removeTr(container);
      if (!text || shouldSkip(text, target)) continue;
      enqueue({ container, text, isOut, chat: isOut ? '' : chatKeyFor(container) });
    }
  }

  function resetAll() {
    queue = [];
    document.querySelectorAll('.wadl-tr').forEach((e) => e.remove());
    document.querySelectorAll('[data-wadl-src]').forEach((e) => delete e.dataset.wadlSrc);
  }

  // ---------- 输入框识别 ----------
  function getInput() {
    const cands = [...document.querySelectorAll('[contenteditable="true"]')].filter((el) => {
      if (isOurs(el)) return false;
      // 只取最外层的可编辑区域
      const parentEditable = el.parentElement && el.parentElement.closest('[contenteditable="true"]');
      if (parentEditable) return false;
      const r = el.getBoundingClientRect();
      // 聊天输入框在页面下半部分（排除左上角的搜索框）
      return r.width > 100 && r.height > 0 && r.top > window.innerHeight * 0.5;
    });
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0];
    // 有多个输入框时（例如发图片时的“添加说明”框盖在聊天输入框上面）：
    // 先选正在输入的那个，再选没被挡住的，最后才按位置选
    const active = document.activeElement;
    const focused = active && cands.find((el) => el === active || el.contains(active));
    if (focused && isUncovered(focused)) return focused;
    const shown = cands.filter(isUncovered);
    const pool = shown.length ? shown : cands;
    const inFooter = pool.find((el) => el.closest('footer'));
    if (inFooter) return inFooter;
    return pool.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a));
  }

  // 元素有没有被别的层挡住（我们自己的工具条、提示不算遮挡）
  function isUncovered(el) {
    const r = el.getBoundingClientRect();
    const pts = [[r.left + Math.min(20, r.width / 2), r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2]];
    return pts.some(([x, y]) => {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit) || (hit.closest && isOurs(hit)));
    });
  }

  // ---------- 发送：输入框翻译 ----------
  // WhatsApp 输入框是 Lexical 编辑器：它自己维护光标，只在 selectionchange（异步）时同步。
  // 所以每次改选区后都要等一下再输入，否则文字会被插到旧光标处（原文后面）。
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));
  const inputText = (el) => norm((el.innerText || '').replace(/\n{2,}/g, '\n'));

  async function selectAllIn(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    await tick(40);
  }

  async function clearInput(el) {
    for (let i = 0; i < 3 && inputText(el); i++) {
      await selectAllIn(el);
      document.execCommand('delete');
      await tick(40);
    }
    return !inputText(el);
  }

  async function writeInto(el, text, mode) {
    await selectAllIn(el);
    if (mode === 'paste') {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } else {
      document.execCommand('insertText', false, text);
    }
    await tick(60);
  }

  let replacing = false;
  async function replaceInput(el, text) {
    replacing = true;
    try {
      const want = norm(text);
      // 先“全选 + 粘贴”：Lexical 会用它自己的粘贴逻辑替换全部内容（前提是选区已同步）。
      // 普通输入框不认模拟粘贴，再退回到 insertText。
      for (const mode of ['paste', 'insert']) {
        await writeInto(el, text, mode);
        if (inputText(el) === want) return true;
        await clearInput(el);
        if (inputText(el) === want) return true;
      }
      // 最后一招：清空后再粘贴一次
      await clearInput(el);
      await writeInto(el, text, 'paste');
      return inputText(el) === want;
    } finally {
      replacing = false;
    }
  }

  // 最近几条聊天（原文），给 AI 作为上下文；只在 AI 翻译发送内容时使用
  function chatContext() {
    return findMessages().slice(-8).map(({ textEl, isOut }) => {
      const t = norm(textEl.innerText).slice(0, 300);
      return t ? (isOut ? 'Me: ' : 'Customer: ') + t : '';
    }).filter(Boolean);
  }

  // ---------- 回译校对：把译文再翻回中文，确认意思没跑偏 ----------
  const backBox = document.createElement('div');
  backBox.id = 'wadl-back';
  const backLabel = document.createElement('span');
  backLabel.className = 'wadl-back-label';
  const backText = document.createElement('span');
  backText.className = 'wadl-back-text';
  const backRedo = document.createElement('button');
  backRedo.textContent = '↻';
  backRedo.title = tr('按输入框当前内容重新回译（Alt+B）');
  const backClose = document.createElement('button');
  backClose.textContent = '×';
  backClose.title = tr('关闭');
  backBox.append(backLabel, backText, backRedo, backClose);
  let back = null; // { forText, label, text, state }
  let backSeq = 0;

  function langOfTarget(code) { return WADL_LANGS.find((l) => l[0] === code); }

  async function runBack(foreign, targetCode) {
    const seq = ++backSeq;
    back = { forText: norm(foreign), label: tr('回译'), text: tr('回译中…'), state: 'loading' };
    renderBack();
    const l = langOfTarget(targetCode);
    // DeepL 支持该语言时用 DeepL 回译（快）；否则交给 AI（DeepL 会把不认识的语言乱译）
    const engine = l && l[3] ? 'deepl' : 'qwen';
    const resp = await send({ type: 'translate', texts: [foreign], target: settings.incomingTarget, direction: 'incoming', engine, source: targetCode });
    if (seq !== backSeq || !back) return;
    if (!resp.ok) back = { ...back, text: resp.error, state: 'error' };
    else back = { ...back, text: resp.results[0].text, state: 'ok', engine: resp.engine };
    renderBack();
  }

  function renderBack() {
    if (!back) { backBox.style.display = 'none'; return; }
    backLabel.textContent = back.label + (back.engine ? `·${WADL_ENGINE_TAGS[back.engine] || ''}` : '') + tr('：');
    backText.textContent = back.text;
    backBox.className = back.state === 'error' ? 'wadl-err' : back.state === 'loading' ? 'wadl-loading' : '';
    const input = getInput();
    const stale = input && back.forText && norm(input.innerText) !== back.forText;
    backBox.classList.toggle('wadl-stale', !!stale);
    backBox.title = stale ? tr('输入框内容已修改，点 ↻ 重新回译') : '';
    positionFloating();
  }

  function redoBack() {
    const input = getInput();
    const t = input && (input.innerText || '').trim();
    if (!t) return;
    runBack(t, currentTarget().lang);
  }

  [backRedo, backClose].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  backRedo.addEventListener('click', redoBack);
  backClose.addEventListener('click', () => { back = null; backSeq++; renderBack(); });

  let busy = false;
  async function translateOutgoing() {
    if (busy) return;
    const input = getInput();
    if (!input) { toast(tr('没有找到输入框，请先打开一个聊天'), true); return; }
    const text = (input.innerText || '').replace(/\n{2,}/g, '\n').trim();
    if (!text) { toast(tr('输入框是空的')); return; }

    busy = true;
    goBtn.textContent = '…';
    const target = currentTarget().lang;
    const resp = await send({
      type: 'translate',
      texts: [text],
      target,
      direction: 'outgoing',
      context: settings.useContext ? chatContext() : null
    });
    busy = false;
    goBtn.textContent = tr('译');

    if (!resp.ok) { toast(resp.error, true); return; }
    if (resp.note) toast(resp.note);
    const out = resp.results[0].text;
    lastOriginal = text;
    if (!(await replaceInput(input, out))) {
      try { await navigator.clipboard.writeText(out); } catch (e) { /* ignore */ }
      toast(tr('无法自动写入输入框，译文已复制，请按 Ctrl+V 粘贴'), true);
    }
    if (settings.backTranslate && !isMine(target)) runBack(out, target);
    updateBar();
  }

  // ---------- 快捷话术：输入 / 加关键词调出 ----------
  const phraseBox = document.createElement('div');
  phraseBox.id = 'wadl-phrases';
  let phraseList = [];
  let phraseIdx = 0;
  let phraseOpen = false;
  let phraseFrom = '';     // 'key'：输入触发键打开（内容变了就关）；'button'：点“话”打开（一直显示到选择、Esc 或点别处）

  // 话术触发键：/（默认）或 ;（WhatsApp Business 用户推荐，因为 Business 的快捷回复也用 /）。中文输入法下的“；”同样有效
  const triggerRe = () => (settings.phraseTrigger === ';' ? /^[;；](\S{0,20})$/ : /^\/(\S{0,20})$/);
  const triggerChar = () => (settings.phraseTrigger === ';' ? ';' : '/');

  function parsePhrases(text) {
    return (text || '').split('\n').map((line) => {
      const m = line.match(/^\s*([^|｜]+?)\s*[|｜]\s*(.+?)\s*$/);
      return m ? { key: m[1], text: m[2].replace(/\\n/g, '\n') } : null;
    }).filter(Boolean);
  }

  function openPhrases(query, from) {
    phraseFrom = from || 'key';
    const q = (query || '').toLowerCase();
    const all = parsePhrases(settings.phrases);
    // 关键词开头匹配的排最前，其次是关键词包含、正文包含
    const rank = (p) => { const k = p.key.toLowerCase(); return !q ? 0 : k.startsWith(q) ? 0 : k.includes(q) ? 1 : p.text.toLowerCase().includes(q) ? 2 : 9; };
    phraseList = all.map((p, i) => ({ p, i, r: rank(p) })).filter((x) => x.r < 9).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.p).slice(0, 12);
    if (!phraseList.length) {
      closePhrases();
      if (!all.length) toast(tr('还没有快捷话术，请在插件设置中添加'));
      return;
    }
    phraseIdx = Math.min(phraseIdx, phraseList.length - 1);
    phraseOpen = true;
    renderPhrases();
  }

  function closePhrases() {
    phraseOpen = false;
    phraseFrom = '';
    phraseIdx = 0;
    phraseBox.style.display = 'none';
  }

  function renderPhrases() {
    phraseBox.textContent = '';
    const head = document.createElement('div');
    head.className = 'wadl-ph-head';
    head.textContent = tr('快捷话术 → {lang}　↑↓ 选择 · Enter 插入 · Esc 关闭', { lang: tlLangName(langOfTarget(currentTarget().lang)) || currentTarget().lang });
    phraseBox.appendChild(head);
    phraseList.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'wadl-ph-item' + (i === phraseIdx ? ' wadl-active' : '');
      const k = document.createElement('b');
      k.textContent = p.key;
      const t = document.createElement('span');
      t.textContent = p.text;
      item.append(k, t);
      item.addEventListener('mousedown', (e) => { e.preventDefault(); insertPhrase(p); });
      item.addEventListener('mouseenter', () => { phraseIdx = i; [...phraseBox.querySelectorAll('.wadl-ph-item')].forEach((el, j) => el.classList.toggle('wadl-active', j === i)); });
      phraseBox.appendChild(item);
    });
    phraseBox.style.display = 'block';
    positionFloating();
  }

  // 把一段中文翻译成当前客户的语言并填入输入框（话术、商机卡的起草/追问共用）
  // keep：输入框里已有、要保留在前面的文字（点“话”插入话术时不覆盖你已经写好的内容）
  async function insertChinese(text, label, loadingText, keep) {
    const input = getInput();
    if (!input) { toast(tr('没有找到输入框，请先打开一个聊天'), true); return false; }
    const join = (x) => (keep ? keep + (/\s$/.test(keep) ? '' : ' ') + x : x);
    const target = currentTarget().lang;
    if (isMine(target)) { await replaceInput(input, join(text)); return true; }
    backSeq++;
    back = { forText: '', label, text: loadingText || tr('正在翻译…'), state: 'loading' };
    renderBack();
    const resp = await send({ type: 'translate', texts: [text], target, direction: 'outgoing' });
    if (!resp.ok) { await replaceInput(input, join(text)); back = null; renderBack(); toast(resp.error, true); return false; }
    if (resp.note) toast(resp.note);
    const out = join(resp.results[0].text);
    await replaceInput(input, out);
    lastOriginal = keep ? join(text) : text;
    backSeq++;
    back = { forText: norm(out), label: tr('{label}原文', { label }), text, state: 'ok' };
    renderBack();
    updateBar();
    return true;
  }

  async function insertPhrase(p) {
    // 点“话”打开时，保留输入框里已经写好的文字；输入触发键打开时，替换掉“/关键词”
    let keep = '';
    if (phraseFrom === 'button') {
      const input = getInput();
      const t = input ? (input.innerText || '').replace(/\n+$/, '') : '';
      if (t.trim() && !triggerRe().test(t)) keep = t;
    }
    closePhrases();
    await insertChinese(p.text, tr('话术'), tr('正在翻译“{k}”…', { k: p.key }), keep);
  }

  // 监听输入框：内容以 / 开头时弹出话术
  // Lexical 接管输入时不一定触发 input 事件，所以按键松开时也检查一次
  let lastSlash = null;
  function checkSlash() {
    if (replacing) return;
    const input = getInput();
    if (!input || !settings.enabled) return;
    const t = (input.innerText || '').replace(/\n+$/, '');
    const m = t.match(triggerRe());
    if (m) {
      if (!phraseOpen || phraseFrom !== 'key' || lastSlash !== m[1]) { if (lastSlash !== m[1]) phraseIdx = 0; lastSlash = m[1]; openPhrases(m[1], 'key'); }
    } else {
      lastSlash = null;
      if (phraseOpen && phraseFrom === 'key') closePhrases();
    }
    if (back) renderBack();
  }
  document.addEventListener('input', checkSlash, true);
  document.addEventListener('beforeinput', () => setTimeout(checkSlash, 0), true);
  document.addEventListener('compositionend', () => setTimeout(checkSlash, 0), true);
  document.addEventListener('keyup', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    checkSlash();
  }, true);

  async function undoOutgoing() {
    const input = getInput();
    if (!input || lastOriginal == null) return;
    await replaceInput(input, lastOriginal);
    lastOriginal = null;
    updateBar();
  }

  // ---------- 悬浮工具条 ----------
  const bar = document.createElement('div');
  bar.id = 'wadl-bar';
  const engBtn = document.createElement('button');
  engBtn.className = 'wadl-eng';
  const langMode = document.createElement('span');
  langMode.className = 'wadl-mode';
  const langSel = document.createElement('select');
  const phBtn = document.createElement('button');
  phBtn.className = 'wadl-ph';
  const goBtn = document.createElement('button');
  goBtn.className = 'wadl-go';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'wadl-undo';
  // 界面语言切换时重新设置工具条文字
  function applyLabels() {
    const v = langSel.value;
    langSel.textContent = '';
    langSel.add(new Option(tr('↺ 恢复自动识别'), '__auto'));
    for (const l of WADL_LANGS) langSel.add(new Option(tlLangOption(l), l[0]));
    if (v) langSel.value = v;
    phBtn.textContent = tr('话');
    phBtn.title = tr('快捷话术（也可在输入框输入 {k} 调出）', { k: triggerChar() });
    if (!busy) goBtn.textContent = tr('译');
    goBtn.title = tr('翻译输入框内容（Alt+T）');
    undoBtn.textContent = tr('↩ 原文');
    undoBtn.title = tr('恢复翻译前的原文');
    backRedo.title = tr('按输入框当前内容重新回译（Alt+B）');
    backClose.title = tr('关闭');
    bar.classList.toggle('wadl-en', TL_LANG === 'en');
  }
  applyLabels();
  bar.append(engBtn, langMode, langSel, goBtn, undoBtn, phBtn);
  document.body.append(bar, backBox, phraseBox);

  [engBtn, goBtn, undoBtn, phBtn].forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  phBtn.addEventListener('click', () => { if (phraseOpen) closePhrases(); else { phraseIdx = 0; lastSlash = null; openPhrases('', 'button'); } });
  // 点“话”打开的话术框：点页面其他地方就关闭
  document.addEventListener('mousedown', (e) => {
    if (phraseOpen && phraseFrom === 'button' && !phraseBox.contains(e.target) && !phBtn.contains(e.target)) closePhrases();
  }, true);
  engBtn.addEventListener('click', () => {
    const next = otherEngine(settings.outgoingEngine);
    if (next) chrome.storage.local.set({ outgoingEngine: next });
    else toast(tr('只填写了一个引擎的 Key，无法切换'));
  });
  goBtn.addEventListener('click', translateOutgoing);
  undoBtn.addEventListener('click', undoOutgoing);
  langSel.addEventListener('change', () => {
    const { chat } = currentTarget();
    const v = langSel.value;
    if (!chat) {
      if (v !== '__auto') chrome.storage.local.set({ outgoingTarget: v });
    } else if (v === '__auto') {
      delete chatLangs[chat];
      recomputeChat(chat);
      const top = chatLangs[chat] && chatLangs[chat].l;
      saveChatLangs();
      toast(top ? tr('已恢复自动识别') : tr('已恢复自动识别（等客户发来消息后自动设置）'));
    } else {
      chatLangs[chat] = { l: v, m: true, t: Date.now() };
      saveChatLangs();
    }
    updateBar();
  });

  // 工具条、回译框、话术框的位置都跟随输入框
  function positionFloating() {
    const input = getInput();
    if (!input || bar.style.display === 'none') { backBox.style.display = 'none'; phraseBox.style.display = 'none'; return; }
    const r = input.getBoundingClientRect();
    const barTop = Math.max(0, r.top - 40);
    let bottom = window.innerHeight - barTop + 4;
    if (!back) backBox.style.display = 'none';
    if (!phraseOpen) phraseBox.style.display = 'none';
    if (back) {
      backBox.style.display = 'flex';
      backBox.style.bottom = bottom + 'px';
      backBox.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      backBox.style.maxWidth = Math.max(260, Math.min(560, r.width)) + 'px';
      bottom += backBox.offsetHeight + 4;
    }
    if (phraseOpen) {
      phraseBox.style.display = 'block';
      phraseBox.style.bottom = bottom + 'px';
      phraseBox.style.left = Math.max(8, r.left) + 'px';
      phraseBox.style.width = Math.max(300, Math.min(560, r.width)) + 'px';
    }
  }

  function updateBar() {
    const input = settings.enabled ? getInput() : null;
    if (!input) { bar.style.display = 'none'; positionFloating(); return; }
    const r = input.getBoundingClientRect();
    bar.style.display = 'flex';
    bar.style.top = Math.max(0, r.top - 40) + 'px';
    bar.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    const cur = currentTarget();
    if (langSel.value !== cur.lang) langSel.value = cur.lang;
    langSel.options[0].hidden = !cur.chat || cur.mode !== 'manual';
    langMode.textContent = cur.mode === 'manual' ? tr('手动') : cur.mode === 'auto' ? tr('自动') : tr('默认');
    langMode.className = 'wadl-mode wadl-mode-' + cur.mode;
    langSel.title = cur.mode === 'manual' ? tr('已为这个聊天手动指定语言（选“恢复自动识别”可取消）')
      : cur.mode === 'auto' ? tr('根据客户消息自动识别的语言（手动选择后将固定为该语言）')
      : tr('默认语言（客户发来消息后会自动识别；也可手动为这个聊天指定）');
    const eng = settings.outgoingEngine;
    engBtn.textContent = WADL_ENGINE_TAGS[eng] || eng;
    engBtn.classList.toggle('wadl-eng-ai', eng === 'deepseek');
    engBtn.classList.toggle('wadl-eng-qwen', eng === 'qwen');
    engBtn.title = tr('发送翻译引擎：{e}（点击切换）', { e: engineName(settings.outgoingEngine) });
    if (!norm(input.innerText)) { lastOriginal = null; if (back) { back = null; backSeq++; } if (phraseOpen && phraseFrom === 'key') closePhrases(); }
    undoBtn.style.display = lastOriginal != null ? '' : 'none';
    phBtn.style.display = settings.phrases && settings.phrases.trim() ? '' : 'none';
    if (back) renderBack(); else positionFloating();
  }

  // ---------- 诊断（Alt+Shift+D）：只导出页面结构，不包含任何消息文字或号码 ----------
  function skeleton(el, depth, lines) {
    if (depth > 9 || lines.length > 120) return;
    const parts = [el.tagName.toLowerCase()];
    if (el.id) parts.push('#' + el.id);
    if (typeof el.className === 'string' && el.className.trim()) {
      parts.push('.' + el.className.trim().split(/\s+/).slice(0, 4).join('.'));
    }
    for (const a of el.attributes) {
      if (a.name === 'class' || a.name === 'id' || a.name === 'style') continue;
      if (a.name === 'data-id') parts.push(`[data-id=${a.value.split('_')[0]}_…]`);
      else if (['role', 'dir', 'contenteditable', 'data-tab', 'tabindex'].includes(a.name)) parts.push(`[${a.name}=${a.value}]`);
      else if (a.name.startsWith('data-') || a.name.startsWith('aria-')) parts.push(`[${a.name}]`);
    }
    const textLen = [...el.childNodes].filter((n) => n.nodeType === 3).reduce((s, n) => s + n.textContent.trim().length, 0);
    if (textLen) parts.push(`  (文字${textLen}字)`);
    lines.push('  '.repeat(depth) + parts.join(''));
    [...el.children].slice(0, 8).forEach((c) => skeleton(c, depth + 1, lines));
  }

  // 语言识别相关的诊断（号码、名称都打码，只保留格式）
  function maskId(id) {
    return String(id).replace(/[0-9]/g, '9').replace(/[A-F0-9]{8,}/g, 'X…').replace(/[a-z]{3,}(?=@)/gi, 'name').slice(0, 60);
  }
  function langDiag() {
    const msgs = findMessages();
    const out = msgs.filter((m) => m.isOut).length;
    const chat = currentChatKey();
    const cur = currentTarget();
    const ids = [...document.querySelectorAll('[data-id]')].filter((r) => !isOurs(r)).slice(-3).map((r) => maskId(r.dataset.id));
    const name = headerName();
    msgs.slice(-1).forEach((m) => isOutgoing(m.textEl));
    return [
      `--- 客户语言识别 ---`,
      `自动识别开关=${settings.autoChatLang}  当前模式=${cur.mode}  当前语言=${cur.lang}`,
      `聊天识别来源=${chatSource}  聊天键=${chat ? '有' : '无'}  顶部名称=${name ? '有（' + name.length + '字）' : '无'}`,
      `收到的消息=${msgs.length - out}  发出的消息=${out}  方向判断依据=${dirSource || '无'}`,
      `本聊天投票=${JSON.stringify(chatVotes[chat] || {})}  记录=${JSON.stringify(chatLangs[chat] || null)}`,
      `data-id 格式样例=${ids.join(' | ') || '无'}`,
      `--- 聊天列表（未读提醒） ---`,
      (() => { const D = window.__tradelingoDeal; if (!D) return '商机模块未加载'; D.scanSidebar(); const i = D.sidebarInfo(); return `聊天列表=${i.found ? '已识别' : '未识别'}  行数=${i.rows}  有未读=${i.unread}  匹配到作战卡=${i.matched}`; })()
    ];
  }

  async function diagnose() {
    const q = (s) => { try { return document.querySelectorAll(s).length; } catch (e) { return 'err'; } };
    const lines = [
      `TradeLingo 诊断 v${VERSION}  ${location.host}  窗口 ${innerWidth}x${innerHeight}`,
      `#main=${q('#main')} footer=${q('footer')} [data-pre-plain-text]=${q('[data-pre-plain-text]')} .message-in=${q('.message-in')} .message-out=${q('.message-out')}`,
      `.selectable-text=${q('.selectable-text')} [data-id]=${q('[data-id]')} [role=row]=${q('[role="row"]')} [role=application]=${q('[role="application"]')}`,
      `识别到消息=${findMessages().length}  识别到输入框=${getInput() ? '是' : '否'}`,
      ...langDiag(),
      '--- 可编辑区域 ---'
    ];
    document.querySelectorAll('[contenteditable="true"], [role="textbox"], textarea').forEach((el) => {
      const r = el.getBoundingClientRect();
      const attrs = [...el.attributes].filter((a) => !['style', 'class'].includes(a.name)).map((a) => a.name.startsWith('aria-') ? a.name : `${a.name}=${a.value.slice(0, 15)}`).join(' ');
      lines.push(`${el.tagName.toLowerCase()} ${attrs}  pos=(${Math.round(r.left)},${Math.round(r.top)}) size=${Math.round(r.width)}x${Math.round(r.height)} 在footer内=${!!el.closest('footer')}`);
    });
    const rows = document.querySelectorAll('[role="row"]');
    const ids = document.querySelectorAll('[data-id]');
    const sample = rows[rows.length - 1] || ids[ids.length - 1];
    lines.push('--- 最后一条消息的结构 ---');
    if (sample) skeleton(sample, 0, lines);
    else lines.push('（未找到 role=row 或 data-id 元素）');

    const report = lines.join('\n');
    console.log(report);
    try {
      await navigator.clipboard.writeText(report);
      toast(tr('诊断信息已复制到剪贴板（不含消息内容），请粘贴发给开发者'));
      return true;
    } catch (e) {
      toast(tr('无法写入剪贴板，请按 F12 在 Console 中复制 [WADL] 诊断内容'), true);
      return false;
    }
  }

  // ---------- 快捷键 ----------
  document.addEventListener('keydown', (e) => {
    // 话术菜单打开时，接管方向键 / 回车 / Tab / Esc（否则回车会直接把 “/关键词” 发出去）
    if (phraseOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key) && !e.isComposing) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { closePhrases(); return; }
      if (e.key === 'ArrowDown') { phraseIdx = (phraseIdx + 1) % phraseList.length; renderPhrases(); return; }
      if (e.key === 'ArrowUp') { phraseIdx = (phraseIdx - 1 + phraseList.length) % phraseList.length; renderPhrases(); return; }
      checkSlash(); // 按输入框当前内容重新筛选，确保插入的是看到的那一条
      if (!phraseOpen || !phraseList.length) return;
      insertPhrase(phraseList[Math.min(phraseIdx, phraseList.length - 1)]);
      return;
    }
    if (e.altKey && !e.shiftKey && e.code === 'KeyB' && settings.enabled) {
      const input = getInput();
      if (input && input.contains(document.activeElement)) { e.preventDefault(); e.stopPropagation(); redoBack(); }
      return;
    }
    if (e.altKey && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault();
      e.stopPropagation();
      diagnose();
      return;
    }
    if (!settings.enabled || !e.altKey || e.shiftKey || e.code !== 'KeyT') return;
    const input = getInput();
    if (input && input.contains(document.activeElement)) {
      e.preventDefault();
      e.stopPropagation();
      translateOutgoing();
    }
  }, true);

  // ---------- 健康检查：WhatsApp 改版后识别不到关键元素时，明确提示用户 ----------
  // 只在“页面上明显有聊天内容，插件却认不出来”时报警，并且要连续多次（约 15 秒）才提示，避免误报。
  const HEALTH_NEED = 3;
  let healthStreak = 0;
  let healthPend = '';     // 正在累计的问题组合
  let healthKey = '';      // 已经提示过的问题组合
  let healthDismissed = false;
  let healthUpdateAsked = false;
  const healthBox = document.createElement('div');
  healthBox.id = 'tl-health';
  healthBox.style.display = 'none';
  document.body.appendChild(healthBox);

  // 聊天区域里“看起来像消息”的行：在输入框上方、带有较长文字
  function visibleChatRows(input) {
    const ir = input && input.getBoundingClientRect();
    let n = 0;
    for (const row of document.querySelectorAll('[role="row"], [data-id], [role="listitem"]')) {
      if (isOurs(row) || row.querySelector('[role="row"], [data-id]')) continue;
      const r = row.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (ir ? (r.right < ir.left + 20 || r.bottom > ir.top + 5) : r.left < window.innerWidth * 0.3) continue;
      const t = norm(row.innerText || '').replace(/\d{1,2}:\d{2}(\s?[AaPp][Mm])?/g, '');
      if (t.length >= 12) n++;
      if (n >= 3) break;
    }
    return n;
  }

  // 返回识别不到的部分：messages / input / chat
  function healthProblems() {
    if (!settings.enabled || document.hidden) return null; // null = 本次不判断
    const input = getInput();
    const msgs = findMessages();
    const problems = [];
    if (input && !msgs.length && visibleChatRows(input) >= 3) problems.push('messages');
    if (!input && msgs.length >= 3 && (document.querySelector('footer') || document.querySelector('[role="textbox"]'))) problems.push('input');
    if (msgs.length >= 3 && !currentChatKey()) problems.push('chat');
    return problems;
  }

  const PROBLEM_TEXT = {
    messages: () => tr('聊天消息'),
    input: () => tr('输入框'),
    chat: () => tr('当前聊天')
  };

  function renderHealth(problems) {
    healthBox.textContent = '';
    const msg = document.createElement('div');
    msg.className = 'tl-h-msg';
    const b = document.createElement('b');
    b.textContent = tr('TradeLingo 认不出 WhatsApp 页面上的：{what}', { what: problems.map((x) => PROBLEM_TEXT[x]()).join(tr('、')) });
    const p = document.createElement('div');
    p.textContent = tr('WhatsApp 网页可能刚改版，翻译和工具条可能暂时不能正常工作。请先检查插件有没有新版本；没有的话，复制诊断信息反馈给开发者。');
    msg.append(b, p);
    const ops = document.createElement('div');
    ops.className = 'tl-h-ops';
    const mk = (text, cls, fn) => { const x = document.createElement('button'); x.textContent = text; x.className = cls; x.addEventListener('click', fn); return x; };
    const status = document.createElement('div');
    status.className = 'tl-h-status';
    ops.append(
      mk(tr('检查插件更新'), 'tl-h-primary', async () => {
        status.textContent = tr('正在检查…');
        const r = await send({ type: 'checkUpdate' });
        if (r.ok && r.info && r.info.hasNew) { status.textContent = tr('有新版本 v{v}，已打开下载页面。', { v: r.info.latest }); send({ type: 'openOptions', hash: 'update' }); }
        else if (r.ok && r.info && !r.info.error) status.textContent = tr('暂时没有新版本。请复制诊断信息，到 GitHub Issues 反馈，开发者会尽快修复。');
        else status.textContent = tr('无法连接 GitHub 检查更新：{e}', { e: (r.info && r.info.error) || r.error || '' });
      }),
      mk(tr('复制诊断信息'), '', async () => { if (await diagnose()) status.textContent = tr('已复制（不含消息内容）。可以发到 GitHub Issues，或发给推荐你用这个插件的人。'); }),
      mk(tr('去反馈'), '', () => window.open(WADL_REPO + '/issues', '_blank', 'noopener')),
      mk('×', 'tl-h-x', () => { healthDismissed = true; healthBox.style.display = 'none'; })
    );
    healthBox.append(msg, ops, status);
    healthBox.style.display = 'block';
  }

  function checkHealth() {
    const problems = healthProblems();
    if (problems === null) return;
    const key = problems.join(',');
    if (!problems.length) {
      healthStreak = 0;
      healthPend = '';
      if (healthKey) { healthKey = ''; healthBox.style.display = 'none'; chrome.storage.local.set({ wadlHealth: { ok: true, at: Date.now(), v: VERSION } }); }
      return;
    }
    if (key !== healthPend) { healthPend = key; healthStreak = 0; }
    if (++healthStreak < HEALTH_NEED) return;
    if (key !== healthKey) {
      healthKey = key;
      chrome.storage.local.set({ wadlHealth: { ok: false, problems, at: Date.now(), v: VERSION } });
      console.warn('[TradeLingo] 识别不到：' + key);
      // 先在后台查一次新版本：如果已经修好，图标上会出现“新”
      if (!healthUpdateAsked) { healthUpdateAsked = true; send({ type: 'checkUpdate' }); }
    }
    if (!healthDismissed) renderHealth(problems);
  }
  setInterval(checkHealth, 5000);

  // ---------- 启动与监听 ----------
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; scan(); updateBar(); }, 300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', updateBar);
  setInterval(() => { scan(); updateBar(); }, 1500);

  const RESET_KEYS = ['apiKey', 'deepseekKey', 'deepseekModel', 'qwenKey', 'qwenModel', 'qwenRegion', 'incomingEngine', 'glossary', 'enabled', 'autoIncoming', 'translateOwn', 'incomingTarget'];
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let needReset = false;
    for (const k in changes) {
      if (!(k in WADL_DEFAULTS)) continue;
      settings[k] = changes[k].newValue;
      if (RESET_KEYS.includes(k)) needReset = true;
      if (k === 'uiLang') { tlSetUiLang(settings.uiLang); applyLabels(); needReset = true; }
      if (k === 'phraseTrigger') { applyLabels(); if (phraseOpen && phraseFrom === 'key') closePhrases(); }
    }
    if (needReset) { resetAll(); scan(); }
    updateBar();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.wadlChatLangs && changes.wadlChatLangs.newValue) chatLangs = changes.wadlChatLangs.newValue;
  });
  chrome.storage.local.get({ wadlChatLangs: {} }).then((r) => { chatLangs = r.wadlChatLangs || {}; updateBar(); });

  chrome.storage.local.get(WADL_DEFAULTS).then((s) => {
    settings = s;
    tlSetUiLang(s.uiLang);
    applyLabels();
    scan();
    updateBar();
  });

  // 供 deal.js（商机功能）调用的内部接口
  window.__tradelingo = {
    bar, send, toast, norm, findMessages, isOutgoing, currentChatKey, headerName, getInput,
    insertChinese, currentTarget, updateBar, healthProblems, checkHealth,
    settings: () => settings
  };
})();
