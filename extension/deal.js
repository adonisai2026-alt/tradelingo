// TradeLingo — 商机作战卡面板（在 WhatsApp 页面右侧）。分析只用 DeepSeek；起草/追问的翻译走现有翻译设置。
(() => {
  'use strict';
  const T = window.__tradelingo;
  if (!T) return;
  const norm = T.norm;

  // ---------- 读取消息：时间、发送方、正文（号码打码） ----------
  // data-pre-plain-text 形如 “[10:05, 2026/10/15] 名字: ”
  function parseMeta(pre) {
    const m = pre && pre.match(/^\[([^\]]+)\]/);
    if (!m) return { ts: 0, t: '' };
    const inside = m[1];
    const tm = inside.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
    const pm = /下午|晚上|PM|pm/.test(inside);
    const am = /上午|凌晨|早上|AM|am/.test(inside);
    const dm = inside.match(/(\d{1,4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,4})/);
    if (!tm || !dm) return { ts: 0, t: inside.slice(0, 20) };
    let [a, b, c] = [dm[1], dm[2], dm[3]].map(Number);
    let y, mo, d;
    if (a > 31) { y = a; mo = b; d = c; }
    else {
      y = c < 100 ? 2000 + c : c;
      if (a > 12) { d = a; mo = b; }
      else if (b > 12) { mo = a; d = b; }
      else if (/^en-US/i.test(navigator.language)) { mo = a; d = b; }
      else { d = a; mo = b; }
    }
    let h = Number(tm[1]);
    const mi = Number(tm[2]);
    if ((pm || /p/i.test(tm[3] || '')) && h < 12) h += 12;
    if ((am || /a/i.test(tm[3] || '')) && h === 12) h = 0;
    const date = new Date(y, mo - 1, d, h, mi);
    if (isNaN(date)) return { ts: 0, t: inside.slice(0, 20) };
    const p = (n) => String(n).padStart(2, '0');
    return { ts: date.getTime(), t: `${p(mo)}-${p(d)} ${p(h)}:${p(mi)}` };
  }

  // 9 位以上的纯数字串视为电话号码，发给 AI 前打码
  const maskPhones = (s) => s.replace(/\+?\d[\d\s\-()]{7,}\d/g, (x) => (x.replace(/\D/g, '').length >= 9 ? '[号码]' : x)); // 发给 AI 的占位符，固定不翻译

  function collectMessages() {
    return T.findMessages().map(({ container, textEl, isOut }) => {
      const preEl = (container.closest && container.closest('[data-pre-plain-text]')) || (container.querySelector && container.querySelector('[data-pre-plain-text]'));
      const meta = parseMeta(preEl && preEl.getAttribute('data-pre-plain-text'));
      const text = maskPhones(norm(textEl.innerText || '')).slice(0, 600);
      return { out: isOut, ts: meta.ts, t: meta.t, text, sig: meta.t + '|' + text.slice(0, 80) };
    }).filter((m) => m.text);
  }

  // ---------- 存储 ----------
  let deals = {};
  chrome.storage.local.get({ wadlDeals: {} }).then((r) => {
    deals = r.wadlDeals || {};
    // 旧版本里整段保存的手动修改，拆回一条一条
    let migrated = false;
    for (const rec of Object.values(deals)) if (tlMigrateRec(rec)) migrated = true;
    if (migrated) saveDeals();
    refreshBadge();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.wadlDeals) { deals = ch.wadlDeals.newValue || {}; if (open) render(); refreshBadge(); }
  });
  let saveTimer = null;
  function saveDeals() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ wadlDeals: deals }), 200);
  }

  function newMessages(rec, msgs) {
    if (!rec) return msgs;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].sig === rec.lastSig) return msgs.slice(i + 1);
    if (rec.lastTs) return msgs.filter((m) => m.ts > rec.lastTs);
    return [];
  }

  function updateActivity(rec, msgs) {
    let changed = false;
    const lin = Math.max(0, ...msgs.filter((m) => !m.out).map((m) => m.ts));
    const lout = Math.max(0, ...msgs.filter((m) => m.out).map((m) => m.ts));
    if (lin > (rec.lastIn || 0)) { rec.lastIn = lin; changed = true; }
    if (lout > (rec.lastOut || 0)) { rec.lastOut = lout; changed = true; }
    const pending = newMessages(rec, msgs).length;
    if (pending !== (rec.pending || 0)) { rec.pending = pending; changed = true; }
    return changed;
  }

  // ---------- 左侧聊天列表：读取未读数（本地，不消耗 Token） ----------
  // 用来补上“客户发了新消息、但你还没点开那个聊天”的盲区；只处理已有作战卡的客户
  const UNREAD_RE = /(\d+)\s*(?:unread|条未读|條未讀|未读|未讀|непрочитан|غير مقروءة)/i;
  const TIME_RE = /^(\d{1,2}):(\d{2})(?:\s?([AaPp][Mm]))?$/;

  function findSidebar() {
    const byId = document.querySelector('#pane-side');
    if (byId) return byId;
    return [...document.querySelectorAll('[aria-label]')].find((e) => {
      if (!/chat list|聊天列表|对话列表|聊天|chats/i.test(e.getAttribute('aria-label') || '')) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.left < window.innerWidth * 0.4 && e.querySelector('span[title]');
    }) || null;
  }

  // 聊天列表里的时间 → 时间戳（只能确定下限时取下限）
  function listTimeTs(text, now) {
    const t = norm(text);
    const m = t.match(TIME_RE);
    if (m) {
      let h = Number(m[1]);
      if (/p/i.test(m[3] || '') && h < 12) h += 12;
      if (/a/i.test(m[3] || '') && h === 12) h = 0;
      const d = new Date(now); d.setHours(h, Number(m[2]), 0, 0);
      let ts = d.getTime();
      if (ts > now + 60000) ts -= 86400000;
      return ts;
    }
    if (/^(昨天|Yesterday|Вчера|أمس)$/i.test(t)) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() - 1; }
    const dm = t.match(/^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/);
    if (dm) { const meta = parseMeta(`[00:00, ${t}]`); if (meta.ts) return meta.ts + 86400000 - 1; }
    return 0;
  }

  let sidebarInfo = { found: false, rows: 0, unread: 0, matched: 0 };
  function scanSidebar() {
    const side = findSidebar();
    if (!side) { sidebarInfo = { found: false, rows: 0, unread: 0, matched: 0 }; return; }
    const now = Date.now();
    const seen = {};
    const rows = side.querySelectorAll('[role="listitem"], [role="row"]');
    for (const row of rows) {
      const t = row.querySelector('span[title]');
      const name = t && norm(t.getAttribute('title'));
      if (!name || seen[name]) continue;
      let unread = 0;
      for (const e of row.querySelectorAll('[aria-label]')) {
        const m = (e.getAttribute('aria-label') || '').match(UNREAD_RE);
        if (m) { unread = Number(m[1]); break; }
      }
      if (!unread) {
        const badge = row.querySelector('[data-testid="icon-unread-count"]');
        if (badge) unread = parseInt(badge.textContent, 10) || 1;
      }
      const timeEl = [...row.querySelectorAll('span, div')].find((e) => !e.children.length && (TIME_RE.test(norm(e.textContent)) || /^(昨天|Yesterday)$/i.test(norm(e.textContent))));
      // 最后一条消息是自己发的：列表预览前会有勾号（已发送/已送达/已读）
      const mine = !unread && !!row.querySelector('[data-icon*="check"], [data-icon="msg-time"], [data-icon*="status-"]');
      seen[name] = { unread, mine, time: timeEl ? norm(timeEl.textContent) : '' };
    }
    let changed = false;
    let matched = 0;
    for (const rec of Object.values(deals)) {
      const s = rec.title && seen[norm(rec.title)];
      if (!s) continue;
      matched++;
      if (s.unread > 0) {
        if (!rec.unread || !rec.unreadSince) {
          rec.unreadSince = listTimeTs(s.time, now) || now;
          changed = true;
        }
        if (rec.unread !== s.unread) { rec.unread = s.unread; changed = true; }
        if ((rec.lastIn || 0) < rec.unreadSince) { rec.lastIn = rec.unreadSince; changed = true; }
      } else {
        if (rec.unread) { rec.unread = 0; rec.unreadSince = 0; changed = true; }
        // 你已在手机上回复：用列表时间更新“我方最后发言”，提醒随之解除
        if (s.mine) {
          const ts = listTimeTs(s.time, now);
          if (ts && ts > (rec.lastOut || 0) && ts >= (rec.lastIn || 0)) { rec.lastOut = ts; changed = true; }
        }
      }
    }
    sidebarInfo = { found: true, rows: rows.length, unread: Object.values(seen).filter((x) => x.unread).length, matched };
    if (changed) saveDeals();
  }

  // ---------- 工具条按钮 ----------
  const dealBtn = document.createElement('button');
  dealBtn.className = 'wadl-deal-btn';
  dealBtn.textContent = tr('单');
  dealBtn.title = tr('商机作战卡（DeepSeek 分析当前聊天）');
  dealBtn.addEventListener('mousedown', (e) => e.preventDefault());
  dealBtn.addEventListener('click', () => (open ? closePanel() : openPanel()));
  T.bar.appendChild(dealBtn);

  function refreshBadge() {
    const chat = T.currentChatKey();
    const rec = chat && deals[chat];
    dealBtn.classList.toggle('wadl-has-new', !!(rec && rec.pending > 0));
    dealBtn.textContent = tr('单');
    dealBtn.title = rec && rec.pending > 0 ? tr('商机作战卡：有 {n} 条新消息未分析', { n: rec.pending }) : tr('商机作战卡（DeepSeek 分析当前聊天）');
  }

  // ---------- 面板 ----------
  const panel = document.createElement('div');
  panel.id = 'tl-deal';
  panel.style.display = 'none';
  document.body.appendChild(panel);
  let open = false;
  let tab = 'card';
  let busy = '';
  let editing = '';
  let lastChat = '';

  function openPanel() { open = true; panel.style.display = 'flex'; render(); }
  function closePanel() { open = false; panel.style.display = 'none'; editing = ''; }

  let sideTick = 0;
  setInterval(() => {
    if (++sideTick % 5 === 1) scanSidebar(); // 每 10 秒读一次聊天列表
    const chat = T.currentChatKey();
    const rec = chat && deals[chat];
    if (rec) {
      const msgs = collectMessages();
      if (msgs.length && updateActivity(rec, msgs)) saveDeals();
    }
    refreshBadge();
    if (open && chat !== lastChat) { editing = ''; render(); }
  }, 2000);

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const btn = (text, cls, onClick, title) => {
    const b = el('button', cls, text);
    if (title) b.title = title;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  };

  function srcTitle(rec, src) {
    const ids = Array.isArray(src) ? src : [];
    const lines = ids.map((id) => rec.srcMap && rec.srcMap[id]).filter(Boolean)
      .map((s) => `${s.t || ''} ${tlEnum(s.who)}${tlSep()}${s.text.slice(0, 90)}`);
    return lines.length ? tr('依据：') + '\n' + lines.join('\n') : '';
  }
  function withSrc(node, rec, src) {
    const t = srcTitle(rec, src);
    if (t) { node.title = t; node.classList.add('tl-has-src'); }
    return node;
  }

  function render() {
    if (!open) return;
    const chat = T.currentChatKey();
    lastChat = chat;
    const rec = chat && deals[chat];
    panel.textContent = '';

    // 头部
    const head = el('div', 'tl-head');
    head.append(el('b', 'tl-title', rec ? tlDealTitle(rec) : (T.headerName() || tr('当前聊天'))));
    head.append(btn(tr('今日跟进'), 'tl-link', () => T.send({ type: 'openDeals' }), tr('按优先级查看所有客户')));
    head.append(btn('×', 'tl-x', closePanel, tr('关闭')));
    panel.append(head);

    if (!chat) { panel.append(el('div', 'tl-empty', tr('请先打开一个聊天。'))); return; }

    // 操作条
    const msgs = collectMessages();
    if (rec && msgs.length && updateActivity(rec, msgs)) saveDeals();
    const ops = el('div', 'tl-ops');
    if (busy) {
      ops.append(el('span', 'tl-busy', busy));
    } else if (!rec) {
      ops.append(btn(tr('生成作战卡'), 'tl-primary', () => analyze('full'), tr('用 DeepSeek 分析当前聊天中可见的消息')));
      ops.append(el('span', 'tl-hint', tr('将分析当前可见的 {n} 条消息（约 0.01 元）', { n: Math.min(msgs.length, 80) })));
    } else {
      if (rec.pending > 0) ops.append(btn(tr('更新（{n} 条新消息）', { n: rec.pending }), 'tl-primary', () => analyze('update'), tr('只把新消息发给 DeepSeek，费用约为首次生成的一半')));
      else ops.append(el('span', 'tl-hint', tr('没有新消息需要分析')));
      ops.append(btn(tr('重新生成'), 'tl-ghost', () => {
        const anyEdited = TL_LIST_FIELDS.some((f) => tlArr(rec.card[f]).some((x) => x && x.edited)) || (rec.card.next && rec.card.next.edited);
        if (((rec.locked && rec.locked.length) || anyEdited) && !window.confirm(tr('重新生成会覆盖你手动修改过的字段，确定吗？'))) return;
        analyze('full');
      }, tr('从头分析当前可见的消息')));
    }
    panel.append(ops);
    if (!rec) {
      panel.append(el('div', 'tl-empty', tr('作战卡会告诉你：这个单有多热、卡在哪里、你答应过什么、报过什么价，以及下一句该说什么。')));
      return;
    }

    // 标签页
    const tabs = el('div', 'tl-tabs');
    for (const [k, name] of [['card', tr('作战卡')], ['summary', tr('摘要')]]) {
      const t = btn(name, 'tl-tab' + (tab === k ? ' on' : ''), () => { tab = k; render(); });
      tabs.append(t);
    }
    panel.append(tabs);

    const body = el('div', 'tl-body');
    panel.append(body);
    if (tab === 'summary') renderSummary(body, rec);
    else renderCard(body, rec);

    const foot = el('div', 'tl-foot');
    foot.append(el('span', 'tl-hint', tr('分析于 {t} · DeepSeek', { t: new Date(rec.analyzedAt).toLocaleString(TL_LANG === 'en' ? 'en-GB' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })));
    foot.append(btn(tr('复制文本'), 'tl-ghost', () => copy(tlDealText(rec), tr('已复制作战卡文本'))));
    foot.append(btn(tr('复制到 Excel'), 'tl-ghost', () => copy(tlTSV([tlExportCols(), tlExportRow(rec)]), tr('已复制，可直接粘贴到 Excel')), tr('复制为表格（含表头）')));
    panel.append(foot);
  }

  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); T.toast(okMsg); } catch (e) { T.toast(tr('复制失败，请重试'), true); }
  }

  // ---------- 作战卡 ----------
  function section(body, rec, field, label, cls) {
    const box = el('div', 'tl-sec' + (cls ? ' ' + cls : ''));
    const h = el('div', 'tl-sec-h');
    h.append(el('span', 'tl-label', label));
    if ((rec.locked || []).includes(field)) h.append(el('span', 'tl-lock', tr('✎ 已手动')));
    else if (TL_LIST_FIELDS.includes(field)) {
      const n = tlArr(rec.card[field]).filter((x) => x && x.edited).length;
      if (n) { const lk = el('span', 'tl-lock', tr('✎ {n} 条你改过', { n })); lk.title = tr('你改过的条目在 AI 更新时会原样保留，新内容照常加入'); h.append(lk); }
    }
    h.append(btn(tr('编辑'), 'tl-edit', () => { editing = field; render(); }, tr('手动修改；修改后 AI 更新不会覆盖它')));
    box.append(h);
    body.append(box);
    if (editing === field) {
      const ta = el('textarea', 'tl-ta');
      ta.value = tlFieldText(field, rec.card[field]);
      ta.rows = Math.max(2, ta.value.split('\n').length + 1);
      const row = el('div', 'tl-edit-row');
      row.append(btn(tr('保存'), 'tl-primary', () => {
        if (TL_LIST_FIELDS.includes(field)) {
          // 列表：按条保存，改过的条目标记 edited；不锁整项，AI 更新时还能加新条目
          rec.card[field] = tlParseListEdit(field, ta.value, rec.card[field]);
          rec.locked = (rec.locked || []).filter((f) => f !== field);
        } else {
          rec.card[field] = field === 'next' ? tlParseNextEdit(ta.value, rec.card.next) : { manual: ta.value.trim() };
          rec.locked = Array.from(new Set([...(rec.locked || []), field]));
        }
        editing = '';
        saveDeals();
        render();
      }));
      row.append(btn(tr('取消'), 'tl-ghost', () => { editing = ''; render(); }));
      box.append(ta, row);
      setTimeout(() => ta.focus(), 0);
      return null;
    }
    const v = rec.card[field];
    if (tlIsManual(v)) { box.append(el('div', 'tl-text tl-manual', v.manual || tr('（空）'))); return null; }
    return box;
  }

  // 你改过的条目：小铅笔标记
  const edMark = (row, it) => {
    if (it && it.edited) { const m = el('span', 'tl-ed', ' ✎'); m.title = tr('你改过这一条，AI 更新不会改动它'); row.append(m); }
    return row;
  };

  function renderCard(body, rec) {
    const card = rec.card;
    renderSuggestions(body, rec);

    // 关键指标：热度 / 阶段 / 金额
    const kpi = el('div', 'tl-kpi');
    const heat = card.heat;
    const lvl = tlHeatLevel(heat);
    const hk = withSrc(el('div', 'tl-k tl-heat-' + ({ 高: 'hi', 中: 'mid', 低: 'lo' }[lvl] || 'na')), rec, heat && heat.src);
    hk.append(el('small', '', tlLabel('heat')), el('b', '', lvl ? (lvl === '高' ? '🔥 ' + tr('高') : tr(lvl)) : '—'));
    const sk = el('div', 'tl-k');
    sk.append(el('small', '', tlLabel('stage')), el('b', '', tlFieldText('stage', card.stage) || '—'));
    const vk = el('div', 'tl-k');
    vk.title = card.value && card.value.basis ? tr('估算：') + card.value.basis : '';
    vk.append(el('small', '', tr('预估金额（估计）')), el('b', '', tlIsManual(card.value) ? card.value.manual : (tlMoney(card.value) || tr('未知'))));
    kpi.append(hk, sk, vk);
    body.append(kpi);
    if (heat && !tlIsManual(heat) && heat.reason) body.append(withSrc(el('div', 'tl-reason', tr('判断依据：') + heat.reason), rec, heat.src));
    if (tlIsManual(heat) && !lvl) body.append(el('div', 'tl-reason tl-warn', tr('热度请写“高 / 中 / 低”，这样才能用于排序和提醒')));
    const kpiEdit = el('div', 'tl-kpi-edit');
    for (const f of ['heat', 'stage', 'value']) kpiEdit.append(btn(tr('改{x}', { x: tlLabel(f) }), 'tl-edit', () => { editing = f; render(); }));
    body.append(kpiEdit);
    if (['heat', 'stage', 'value'].includes(editing)) section(body, rec, editing, tlLabel(editing));

    // 往来状态（本地计算）
    const w = tlWaiting(rec);
    if (w) body.append(el('div', 'tl-wait tl-wait-' + w.who, (w.who === 'us' ? '⏳ ' : '… ') + w.text));

    // 下一步（最重要）
    let box = section(body, rec, 'next', '▶ ' + tlLabel('next'), 'tl-next');
    if (box) {
      const nx = card.next || {};
      box.append(edMark(withSrc(el('div', 'tl-text tl-strong', tlFieldText('next', nx) || '—'), rec, nx.src), nx));
      if (nx.edited && nx.owner === '我方' && !nx.due && /前|截止|before|by|deadline/i.test(nx.action || '')) box.append(el('div', 'tl-hint tl-warn', tr('没认出截止日期，可以写成 10-20 或 2026-10-20')));
      if (nx.edited && !nx.draft_zh && nx.action) box.append(btn(tr('把这句写给客户'), 'tl-primary', () => T.insertChinese(nx.action, tr('草稿'), tr('正在翻译…'))));
      if (nx.draft_zh) {
        box.append(el('div', 'tl-draft', '“' + nx.draft_zh + '”'));
        box.append(btn(tr('起草这条消息'), 'tl-primary', () => T.insertChinese(nx.draft_zh, tr('草稿'), tr('正在翻译草稿…')), tr('翻译成当前客户的语言并填入输入框，确认后自己发送')));
      }
    }
    const nxManual = tlIsManual(card.next) && card.next.manual; // 旧数据（会在加载时自动转换）
    if (nxManual && editing !== 'next') {
      body.lastChild.append(btn(tr('把这句写给客户'), 'tl-primary', () => T.insertChinese(nxManual, tr('草稿'), tr('正在翻译…'))));
    }

    // 卡点
    box = section(body, rec, 'blockers', tlLabel('blockers'));
    if (box) {
      const list = tlArr(card.blockers);
      if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('暂未发现')));
      for (const b of list) box.append(edMark(withSrc(el('div', 'tl-text', '· ' + b.text), rec, b.src), b));
    }

    // 需求 + 条款 + 客户
    box = section(body, rec, 'needs', tlLabel('needs'));
    if (box) {
      const list = tlArr(card.needs);
      if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('未提及')));
      for (const n of list) box.append(edMark(withSrc(el('div', 'tl-text', '· ' + tlFieldText('needs', [n])), rec, n.src), n));
    }
    box = section(body, rec, 'terms', tlLabel('terms'));
    if (box) box.append(el('div', 'tl-text' + (card.terms ? '' : ' tl-muted'), card.terms || tr('未提及')));
    box = section(body, rec, 'customer', tlLabel('customer'));
    if (box) box.append(el('div', 'tl-text', tlFieldText('customer', card.customer) || tr('未知')));

    // 承诺记录
    box = section(body, rec, 'commitments', '📌 ' + tlLabel('commitments'));
    if (box) {
      const list = tlArr(card.commitments);
      const today = tlTodayStr();
      if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('暂无')));
      for (const c of list) {
        const row = withSrc(el('div', 'tl-text', `· ${c.date ? c.date + ' ' : ''}${tlEnum(c.who)}${tlSep()}${c.what}`), rec, c.src);
        if (c.due) {
          const late = c.who === '我方' && c.due <= today;
          row.append(el('span', 'tl-due' + (late ? ' tl-late' : ''), ' ' + (late ? (c.due < today ? tr('已逾期') : tr('今天到期')) : tr('截止 {x}', { x: c.due.slice(5) }))));
        }
        edMark(row, c);
        if (tlDueUnclear(c)) row.append(el('div', 'tl-hint tl-warn', tr('没认出截止日期，可以写成 10-20 或 2026-10-20，才会按时提醒')));
        box.append(row);
      }
    }

    // 报价记录
    box = section(body, rec, 'quotes', '💰 ' + tlLabel('quotes'));
    if (box) {
      const list = tlArr(card.quotes);
      if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('暂无')));
      for (const q of list) box.append(edMark(withSrc(el('div', 'tl-text', '· ' + tlFieldText('quotes', [q])), rec, q.src), q));
    }

    // 缺失信息 + 一键追问
    box = section(body, rec, 'missing', tlLabel('missing'));
    if (box) {
      const list = tlArr(card.missing);
      if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('关键信息都已明确')));
      for (const m of list) {
        const row = el('div', 'tl-miss');
        edMark(row.appendChild(el('span', '', m.field)), m);
        if (m.ask_zh) row.append(btn(tr('生成追问'), 'tl-mini', () => T.insertChinese(m.ask_zh, tr('追问'), tr('正在翻译追问…')), m.ask_zh));
        box.append(row);
      }
    }
  }

  // ---------- AI 更新建议：逐条采纳 ----------
  function renderSuggestions(body, rec) {
    const sug = rec.suggestions || [];
    if (!sug.length) return;
    const box = el('div', 'tl-sug');
    const h = el('div', 'tl-sec-h');
    h.append(el('span', 'tl-label', tr('AI 更新建议（{n}）', { n: sug.length })));
    h.append(btn(tr('全部采纳'), 'tl-mini', () => { sug.slice().forEach(() => accept(rec, 0)); }));
    box.append(h);
    sug.forEach((s, i) => {
      const row = el('div', 'tl-sug-row');
      const locked = (rec.locked || []).includes(s.field);
      const keptN = TL_LIST_FIELDS.includes(s.field) ? tlArr(s.value).filter((x) => x && x.edited).length : 0;
      row.append(el('b', '', tlLabel(s.field) + (locked ? tr('（你手动改过）') : keptN ? tr('（保留你改过的 {n} 条）', { n: keptN }) : '')));
      if (TL_LIST_FIELDS.includes(s.field) && !tlIsManual(rec.card[s.field])) {
        // 列表：只显示新增和去掉的条目
        const line = (it) => tlCleanLine(tlFieldText(s.field, [it]));
        const oldL = tlArr(rec.card[s.field]).map(line);
        const newL = tlArr(s.value).map(line);
        const added = newL.filter((x) => !oldL.includes(x));
        const removed = oldL.filter((x) => !newL.includes(x));
        for (const x of added) row.append(el('div', 'tl-sug-diff tl-add', '+ ' + x));
        for (const x of removed) row.append(el('div', 'tl-sug-diff tl-del', '− ' + x));
        if (!added.length && !removed.length) row.append(el('div', 'tl-sug-diff', tr('（只调整了顺序或细节）')));
      } else {
        const oldT = tlFieldText(s.field, rec.card[s.field]) || tr('空');
        const newT = tlFieldText(s.field, s.value) || tr('空');
        row.append(el('div', 'tl-sug-diff', `${oldT.replace(/\n/g, tr('；'))}  →  ${newT.replace(/\n/g, tr('；'))}`));
      }
      if (s.reason) row.append(el('div', 'tl-hint', s.reason));
      const ops = el('div', 'tl-edit-row');
      ops.append(btn(tr('采纳'), 'tl-primary', () => accept(rec, i)), btn(tr('忽略'), 'tl-ghost', () => { sug.splice(i, 1); saveDeals(); render(); }));
      row.append(ops);
      box.append(row);
    });
    body.append(box);
  }

  function accept(rec, i) {
    const s = rec.suggestions[i];
    if (!s) return;
    rec.card[s.field] = s.value;
    rec.locked = (rec.locked || []).filter((f) => f !== s.field);
    rec.suggestions.splice(i, 1);
    saveDeals();
    render();
  }

  // ---------- 摘要 ----------
  function renderSummary(body, rec) {
    const card = rec.card;
    const list = tlArr(card.summary);
    const box = el('div', 'tl-sec');
    box.append(el('div', 'tl-label', tr('进展摘要')));
    if (!list.length) box.append(el('div', 'tl-text tl-muted', tr('暂无')));
    for (const x of list) box.append(el('div', 'tl-text', '· ' + x));
    body.append(box);
    const cm = tlIsManual(card.commitments) ? [] : tlArr(card.commitments);
    const todo = el('div', 'tl-sec');
    todo.append(el('div', 'tl-label', tr('待办')));
    const ours = cm.filter((c) => c.who === '我方');
    const theirs = cm.filter((c) => c.who === '客户');
    todo.append(el('div', 'tl-text tl-strong', tr('我方要做')));
    if (card.next && !tlIsManual(card.next) && card.next.owner === '我方') todo.append(el('div', 'tl-text', '· ' + card.next.action));
    for (const c of ours) todo.append(el('div', 'tl-text', '· ' + c.what + (c.due ? tr('（截止 {x}）', { x: c.due }) : '')));
    todo.append(el('div', 'tl-text tl-strong', tr('等客户')));
    if (!theirs.length) todo.append(el('div', 'tl-text tl-muted', tr('暂无')));
    for (const c of theirs) todo.append(el('div', 'tl-text', '· ' + c.what));
    body.append(todo);
  }

  // ---------- 调用 DeepSeek ----------
  async function analyze(mode) {
    const chat = T.currentChatKey();
    if (!chat) { T.toast(tr('请先打开一个聊天'), true); return; }
    const msgs = collectMessages();
    if (!msgs.length) { T.toast(tr('当前聊天里没有可分析的文字消息'), true); return; }
    let rec = deals[chat];
    const isUpdate = mode === 'update' && rec;
    const batch = isUpdate ? newMessages(rec, msgs).slice(-80) : msgs.slice(-80);
    if (!batch.length) { T.toast(tr('没有新消息')); return; }
    const startId = isUpdate ? rec.nextId || 1 : 1;
    const srcMap = isUpdate ? { ...(rec.srcMap || {}) } : {};
    const payloadMsgs = batch.map((m, i) => {
      const id = startId + i;
      srcMap[id] = { t: m.t, who: m.out ? '我方' : '客户', text: m.text.slice(0, 200) };
      return { id, time: m.t || null, who: m.out ? '我方' : '客户', text: m.text };
    });
    busy = isUpdate ? tr('DeepSeek 正在分析 {n} 条新消息…', { n: batch.length }) : tr('DeepSeek 正在分析 {n} 条消息…', { n: batch.length });
    render();
    const resp = await T.send({
      type: 'deal', mode: isUpdate ? 'update' : 'full', today: tlTodayStr(), title: T.headerName(), lang: TL_LANG,
      messages: payloadMsgs, card: isUpdate ? rec.card : undefined, locked: isUpdate ? rec.locked : undefined
    });
    busy = '';
    if (!resp.ok) { render(); T.toast(resp.error, true); return; }
    const card = resp.card;
    const last = batch[batch.length - 1];
    const usedIds = new Set(JSON.stringify(card).match(/"src":\[[^\]]*\]/g)?.join(',').match(/\d+/g) || []);
    if (!isUpdate) {
      for (const k of Object.keys(srcMap)) if (!usedIds.has(String(k))) delete srcMap[k];
      rec = deals[chat] = { title: T.headerName(), card, locked: [], suggestions: [], srcMap, nextId: startId + batch.length, createdAt: Date.now() };
    } else {
      const changed = Array.isArray(card.changed) ? card.changed : [];
      const sug = [];
      for (const c of changed) {
        const f = c && c.field;
        if (!TL_DEAL_FIELDS.includes(f) || !(f in card)) continue;
        // 列表字段：你改过的条目一定原样保留（不管 AI 有没有照做），AI 的新条目加进来
        const val = TL_LIST_FIELDS.includes(f) ? tlMergeList(f, rec.card[f], card[f]) : card[f];
        if (JSON.stringify(val) === JSON.stringify(rec.card[f])) continue;
        sug.push({ field: f, value: val, reason: c.reason || '' });
      }
      // 同一字段只保留最新建议
      const keep = (rec.suggestions || []).filter((s) => !sug.some((n) => n.field === s.field));
      rec.suggestions = [...keep, ...sug];
      if (Array.isArray(card.summary)) rec.card.summary = card.summary;
      rec.srcMap = srcMap;
      rec.nextId = startId + batch.length;
      if (!sug.length) T.toast(tr('已分析新消息，作战卡无需改动'));
    }
    rec.title = T.headerName() || rec.title;
    rec.analyzedAt = Date.now();
    rec.lastSig = last.sig;
    rec.lastTs = Math.max(rec.lastTs || 0, ...batch.map((m) => m.ts));
    updateActivity(rec, msgs);
    rec.pending = 0;
    tab = 'card';
    saveDeals();
    render();
    refreshBadge();
  }

  window.__tradelingoDeal = { parseMeta, maskPhones, collectMessages, openPanel, analyze, scanSidebar, listTimeTs, sidebarInfo: () => sidebarInfo, deals: () => deals };
})();
