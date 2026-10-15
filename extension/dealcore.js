// TradeLingo — 商机作战卡的共用逻辑（无 DOM 依赖）：商机面板（deal.js）和今日跟进页（deals.js）共用
var TL_DEAL_FIELDS = ['customer', 'heat', 'stage', 'value', 'needs', 'terms', 'blockers', 'next', 'commitments', 'quotes', 'missing'];
var TL_DEAL_LABELS = {
  customer: '客户', heat: '热度', stage: '阶段', value: '预估金额', needs: '需求', terms: '条款',
  blockers: '卡点', next: '下一步', commitments: '承诺记录', quotes: '报价记录', missing: '缺失信息', summary: '摘要'
};

// 显示用的字段名（随界面语言）
function tlLabel(f) { return tr(TL_DEAL_LABELS[f] || f); }
// AI 返回的固定取值（高/中/低、我方/客户、阶段、客户类型）在内部保持中文，显示时翻译
function tlEnum(v) { return v === null || v === undefined ? '' : tr(String(v)); }
const tlSep = () => tr('：');

function tlIsManual(v) { return !!(v && typeof v === 'object' && !Array.isArray(v) && typeof v.manual === 'string'); }
function tlArr(v) { return Array.isArray(v) ? v : []; }
function tlStr(v) { return v === null || v === undefined ? '' : String(v); }

function tlTodayStr(d) {
  d = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tlMoney(value) {
  if (!value || typeof value !== 'object' || tlIsManual(value)) return '';
  if (typeof value.amount !== 'number' || !isFinite(value.amount)) return '';
  const cur = value.currency || 'USD';
  const sym = { USD: '$', EUR: '€', CNY: '¥', GBP: '£' }[cur] || cur + ' ';
  return '≈ ' + sym + Math.round(value.amount).toLocaleString('en-US');
}

// 把一个字段转成一行或多行文字（用于显示、编辑框初始值、复制、导出）
function tlFieldText(field, v) {
  if (tlIsManual(v)) return v.manual;
  if (v === null || v === undefined) return '';
  switch (field) {
    case 'customer': return [v.name, v.company, v.country].filter(Boolean).join(' · ') + (v.type && v.type !== '未知' ? tr('（{x}）', { x: tlEnum(v.type) }) : '');
    case 'heat': return v.level ? `${tlEnum(v.level)}${v.reason ? tlSep() + v.reason : ''}` : '';
    case 'stage': return tlEnum(tlStr(v));
    case 'value': return tlMoney(v) ? `${tlMoney(v)}${v.basis ? tr('（{x}）', { x: v.basis }) : ''}` : '';
    case 'needs': return tlArr(v).map((n) => [n.item, n.qty ? '× ' + n.qty : '', n.target ? tr('目标价 {x}', { x: n.target }) : ''].filter(Boolean).join(' ')).join('\n');
    case 'terms': return tlStr(v);
    case 'blockers': return tlArr(v).map((b) => b.text).filter(Boolean).join('\n');
    case 'next': return v.action ? `${v.owner ? tlEnum(v.owner) + tlSep() : ''}${v.action}${v.due ? tr('（{x} 前）', { x: v.due }) : ''}` : '';
    case 'commitments': return tlArr(v).map((c) => `${c.date ? c.date + ' ' : ''}${tlEnum(c.who)}${tlSep()}${c.what || ''}${c.due ? tr('（截止 {x}）', { x: c.due }) : ''}`).join('\n');
    case 'quotes': return tlArr(v).map((q) => `${q.date ? q.date + ' ' : ''}${tlEnum(q.who)}${q.item ? ' ' + q.item : ''}${tlSep()}${q.price || ''}`).join('\n');
    case 'missing': return tlArr(v).map((m) => m.field).filter(Boolean).join('\n');
    case 'summary': return tlArr(v).map((x) => '· ' + x).join('\n');
    default: return typeof v === 'string' ? v : JSON.stringify(v);
  }
}

function tlHeatLevel(heat) {
  const t = tlIsManual(heat) ? heat.manual : heat && heat.level;
  if (/高|\bhigh\b|\bhot\b/i.test(t || '')) return '高';
  if (/中|\bmedium\b|\bmid\b|\bwarm\b/i.test(t || '')) return '中';
  if (/低|\blow\b|\bcold\b/i.test(t || '')) return '低';
  return '';
}

function tlAmount(value) {
  if (tlIsManual(value)) {
    const m = value.manual.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|万)?/i);
    if (!m) return 0;
    return parseFloat(m[1]) * (m[2] ? (/k/i.test(m[2]) ? 1000 : 10000) : 1);
  }
  return value && typeof value.amount === 'number' && isFinite(value.amount) ? value.amount : 0;
}

function tlDays(ms) { return Math.floor(ms / 86400000); }
function tlAgo(ms) {
  if (ms < 3600000) return tr('{n} 分钟', { n: Math.max(1, Math.round(ms / 60000)) });
  if (ms < 86400000) return tr('{n} 小时', { n: Math.round(ms / 3600000) });
  return tr('{n} 天', { n: tlDays(ms) });
}

// 往来状态：谁在等谁、等了多久（本地计算，不消耗 Token）
function tlWaiting(rec, now) {
  now = now || Date.now();
  const lin = rec.lastIn || 0;
  const lout = rec.lastOut || 0;
  if (!lin && !lout) return null;
  if (lin > lout) return { who: 'us', ms: now - lin, text: rec.unread > 0 ? tr('客户有 {n} 条未读，已等 {t}', { n: rec.unread, t: tlAgo(now - lin) }) : tr('客户在等你回复：{t}', { t: tlAgo(now - lin) }) };
  return { who: 'customer', ms: now - lout, text: tr('等待客户回复：{t}', { t: tlAgo(now - lout) }) };
}

// 跟进优先级：金额 × 热度 × 紧急度（本地计算）
function tlUrgency(rec, now) {
  now = now || Date.now();
  const today = tlTodayStr(new Date(now));
  const card = rec.card || {};
  const reasons = [];
  let u = 0;
  if (!tlIsManual(card.commitments)) {
    for (const c of tlArr(card.commitments)) {
      if (c.who === '我方' && c.due && c.due <= today) {
        reasons.push(c.due < today ? tr('我方承诺已逾期：{x}', { x: c.what }) : tr('我方承诺今天到期：{x}', { x: c.what }));
        u += 3;
        break;
      }
    }
  }
  const nx = card.next;
  if (nx && !tlIsManual(nx) && nx.owner === '我方' && nx.due && nx.due <= today) { reasons.push(nx.due < today ? tr('下一步已逾期') : tr('下一步今天到期')); u += 2; }
  const w = tlWaiting(rec, now);
  if (w && w.who === 'us') { const d = tlDays(w.ms); reasons.push(w.text); u += 2 + Math.min(d, 3); }
  if (w && w.who === 'customer' && tlDays(w.ms) >= 3) { reasons.push(tr('客户 {n} 天未回复', { n: tlDays(w.ms) })); u += tlDays(w.ms) >= 7 ? 1.5 : 1; }
  if (rec.pending > 0) { reasons.push(tr('{n} 条新消息未分析', { n: rec.pending })); u += 1; }
  const miss = tlIsManual(card.missing) ? [] : tlArr(card.missing);
  if (miss.length) { reasons.push(tr('缺：{x}', { x: miss.map((m) => m.field).slice(0, 2).join(tr('、')) })); u += 0.3; }
  return { u, reasons };
}

function tlScore(rec, now) {
  const heatW = { 高: 3, 中: 2, 低: 1 }[tlHeatLevel((rec.card || {}).heat)] || 1.5;
  const valueW = 1 + Math.log10(1 + tlAmount((rec.card || {}).value) / 1000);
  const { u, reasons } = tlUrgency(rec, now);
  return { score: heatW * valueW * (1 + u), reasons };
}

function tlDealTitle(rec) {
  const c = (rec.card || {}).customer;
  if (c && !tlIsManual(c) && (c.company || c.name)) return c.company || c.name;
  return rec.title || tr('未命名客户');
}

// 纯文本（复制给同事、贴到邮件）
function tlDealText(rec) {
  const card = rec.card || {};
  const lines = [tr('【商机作战卡】{x}', { x: tlDealTitle(rec) })];
  for (const f of ['customer', 'heat', 'stage', 'value', 'next', 'blockers', 'needs', 'terms', 'commitments', 'quotes', 'missing']) {
    const t = tlFieldText(f, card[f]);
    if (t) lines.push(`${tlLabel(f)}${tlSep()}${t.includes('\n') ? '\n  ' + t.replace(/\n/g, '\n  ') : t}`);
  }
  const w = tlWaiting(rec);
  if (w) lines.push(w.text);
  if (tlArr(card.summary).length) lines.push(tlLabel('summary') + tlSep() + '\n' + tlFieldText('summary', card.summary));
  return lines.join('\n');
}

var TL_EXPORT_COLS = ['客户', '热度', '阶段', '预估金额', '需求', '条款', '卡点', '下一步', '承诺记录', '报价记录', '缺失信息', '往来状态', '分析时间'];
function tlExportCols() { return TL_EXPORT_COLS.map((c) => tr(c)); }
function tlExportRow(rec) {
  const c = rec.card || {};
  const w = tlWaiting(rec);
  return [
    tlFieldText('customer', c.customer) || rec.title || '', tlFieldText('heat', c.heat), tlFieldText('stage', c.stage),
    tlFieldText('value', c.value), tlFieldText('needs', c.needs), tlFieldText('terms', c.terms), tlFieldText('blockers', c.blockers),
    tlFieldText('next', c.next), tlFieldText('commitments', c.commitments), tlFieldText('quotes', c.quotes), tlFieldText('missing', c.missing),
    w ? w.text : '', rec.analyzedAt ? new Date(rec.analyzedAt).toLocaleString(TL_LANG === 'en' ? 'en-GB' : 'zh-CN') : ''
  ];
}
function tlTSV(rows) { return rows.map((r) => r.map((x) => tlStr(x).replace(/\t/g, ' ').replace(/\r?\n/g, ' / ')).join('\t')).join('\n'); }
function tlCSV(rows) {
  const esc = (x) => { x = tlStr(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'); // BOM：Excel 打开中文不乱码
}

// 备份导入：与现有数据合并
function tlMergeBackup(cur, b) {
  const KEY_FIELDS = ['apiKey', 'deepseekKey', 'qwenKey', 'notionToken'];
  const patch = {};
  let settings = 0;
  let keys = false;
  for (const [k, v] of Object.entries(b.settings || {})) {
    if (!(k in WADL_DEFAULTS)) continue;
    if (KEY_FIELDS.includes(k)) { if (!v) continue; keys = true; }
    patch[k] = v;
    settings++;
  }
  const deals = { ...(cur.wadlDeals || {}) };
  let dealsAdded = 0;
  let dealsUpdated = 0;
  for (const [k, rec] of Object.entries(b.deals || {})) {
    if (!rec || typeof rec !== 'object' || !rec.card) continue;
    if (!deals[k]) { deals[k] = rec; dealsAdded++; }
    else if ((rec.analyzedAt || 0) > (deals[k].analyzedAt || 0)) { deals[k] = rec; dealsUpdated++; }
  }
  const langs = { ...(cur.wadlChatLangs || {}) };
  let langCount = 0;
  for (const [k, r] of Object.entries(b.chatLangs || {})) {
    if (!r || !r.l) continue;
    const old = langs[k];
    const better = !old || (r.m && !old.m) || (r.m === old.m && (r.t || 0) > (old.t || 0));
    if (better) { langs[k] = r; langCount++; }
  }
  patch.wadlDeals = deals;
  patch.wadlChatLangs = langs;
  return { patch, dealsAdded, dealsUpdated, langs: langCount, settings, keys };
}
