// TradeLingo — 今日跟进：所有客户作战卡按优先级排序（本地计算）
(() => {
  const $ = (id) => document.getElementById(id);
  let deals = {};
  let stage = '全部';
  const STAGES = ['全部', '询盘', '报价', '样品', '谈判', '下单', '售后'];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function stageOf(rec) { return tlFieldText('stage', (rec.card || {}).stage) || '未知'; }

  function rows() {
    const now = Date.now();
    return Object.entries(deals)
      .map(([key, rec]) => ({ key, rec, ...tlScore(rec, now) }))
      .filter((x) => stage === '全部' || stageOf(x.rec).includes(stage))
      .sort((a, b) => b.score - a.score);
  }

  function renderFilters() {
    const box = $('filters');
    box.textContent = '';
    const all = Object.values(deals);
    for (const s of STAGES) {
      const n = s === '全部' ? all.length : all.filter((r) => stageOf(r).includes(s)).length;
      const b = el('button', s === stage ? 'on' : '', `${s} ${n}`);
      b.addEventListener('click', () => { stage = s; render(); });
      box.append(b);
    }
  }

  function render() {
    renderFilters();
    const list = $('list');
    list.textContent = '';
    const items = rows();
    $('sub').textContent = `共 ${Object.keys(deals).length} 个客户 · 按 预估金额 × 热度 × 紧急度 排序，全部在本地计算，不消耗 Token。`;
    if (!items.length) {
      list.append(el('div', 'empty', Object.keys(deals).length ? '这个阶段没有客户。' : '还没有作战卡。在 WhatsApp 中打开客户聊天，点工具条上的“单”生成第一张。'));
      return;
    }
    for (const { key, rec, reasons } of items) {
      const card = rec.card || {};
      const li = el('li');
      const left = el('div');
      left.append(el('div', 'name', tlDealTitle(rec)));
      left.append(el('div', 'meta', [tlFieldText('customer', card.customer), tlFieldText('needs', card.needs).split('\n')[0]].filter(Boolean).join(' · ')));
      const chips = el('div', 'chips');
      const heat = tlHeatLevel(card.heat);
      if (heat) chips.append(el('span', 'chip' + (heat === '高' ? ' hot' : ''), heat === '高' ? '🔥 高' : '热度 ' + heat));
      chips.append(el('span', 'chip', stageOf(rec)));
      const money = tlIsManual(card.value) ? card.value.manual : tlMoney(card.value);
      chips.append(el('span', 'chip', money || '金额未知'));
      li.append(left, chips);
      const why = el('div', 'why');
      for (const r of reasons) why.append(el('span', /逾期|今天到期|在等你/.test(r) ? 'late' : '', r));
      if (!reasons.length) why.append(el('span', '', '暂无紧急事项'));
      li.append(why);
      const nx = tlFieldText('next', card.next);
      if (nx) { const n = el('div', 'next'); n.append(el('b', '', '下一步：'), document.createTextNode(nx)); li.append(n); }
      const ops = el('div', 'row-ops');
      const copyBtn = el('button', '', '复制作战卡');
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(tlDealText(rec)); copyBtn.textContent = '已复制'; } catch (e) { copyBtn.textContent = '复制失败'; }
        setTimeout(() => (copyBtn.textContent = '复制作战卡'), 1500);
      });
      const del = el('button', '', '删除');
      del.addEventListener('click', () => {
        if (!confirm(`删除“${tlDealTitle(rec)}”的作战卡？此操作不能撤销。`)) return;
        delete deals[key];
        chrome.storage.local.set({ wadlDeals: deals });
      });
      ops.append(copyBtn, del);
      li.append(ops);
      list.append(li);
    }
  }

  $('exportCsv').addEventListener('click', () => {
    const data = [TL_EXPORT_COLS, ...rows().map((x) => tlExportRow(x.rec))];
    const blob = new Blob([tlCSV(data)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TradeLingo-商机-${tlTodayStr()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  chrome.storage.local.get({ wadlDeals: {} }).then((r) => { deals = r.wadlDeals || {}; render(); });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.wadlDeals) { deals = ch.wadlDeals.newValue || {}; render(); }
  });
  setInterval(render, 60000); // 往来时间每分钟刷新
})();
