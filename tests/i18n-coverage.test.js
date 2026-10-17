// 收集所有需要英文的中文键：JS 里的 tr('…')、间接键、静态页面文字
const fs = require('fs'); const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '..', 'extension') + '/';
const keys = new Set();
const han = /[一-鿿]/;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'i18n.js')) {
  const src = fs.readFileSync(dir + f, 'utf8');
  for (const m of src.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
}
// 间接键
const vm = require('vm'); const ctx = { navigator: { language: 'zh-CN' } }; vm.createContext(ctx);
for (const f of ['i18n.js', 'common.js', 'dealcore.js']) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx);
vm.runInContext('this.__x = { L: TL_DEAL_LABELS, C: TL_EXPORT_COLS, D: WADL_DS_MODELS, Q: WADL_QWEN_MODELS }', ctx);
const x = ctx.__x;
Object.values(x.L).forEach((v) => keys.add(v)); x.C.forEach((v) => keys.add(v)); x.D.forEach((v) => keys.add(v[1])); x.Q.forEach((v) => keys.add(v[1]));
['高', '中', '低', '我方', '客户', '询盘', '报价', '样品', '谈判', '下单', '售后', '全部', '分销商', '工程商', '终端用户', '贸易商', '未知'].forEach((k) => keys.add(k));
const wel = fs.readFileSync(dir + 'welcome.js', 'utf8');
for (const m of wel.matchAll(/^\s*'((?:[^'\\]|\\.)*[一-鿿](?:[^'\\]|\\.)*)'[,\s]*$/gm)) keys.add(m[1]);
for (const m of wel.matchAll(/note: '((?:[^'\\]|\\.)*)'/g)) if (m[1]) keys.add(m[1]);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ locale: 'zh-CN' });
  await p.addInitScript(() => { window.chrome = { storage: { local: { get: async (d) => d, set: async () => {} }, onChanged: { addListener() {} } }, runtime: { getManifest: () => ({ version: '0' }), getURL: (x) => x, sendMessage: () => {} }, tabs: { create() {} } }; });
  const html = {};
  for (const f of ['options.html', 'deals.html', 'welcome.html']) {
    await p.goto('file://' + dir + f); await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      const out = []; const t = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; if (n.parentElement.closest('[data-t], script, style, textarea, select')) continue; const k = n.nodeValue.replace(/\s+/g, ' ').trim(); if (k) out.push(k); }
      document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach((e) => ['placeholder', 'title', 'aria-label', 'alt'].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v.trim()); }));
      document.querySelectorAll('select option').forEach((o) => { if (!o.closest('select').id.match(/^(inT|outT|incomingTarget|outgoingTarget|deepseekModel|qwenModel)$/) && !o.closest('select.engine,select.lang')) out.push(o.textContent.trim()); });
      document.querySelectorAll('[data-t]').forEach((e) => t.push([e.getAttribute('data-t'), e.innerHTML.trim()]));
      out.push(document.title);
      return { out, t };
    });
    r.out.forEach((k) => keys.add(k)); r.t.forEach(([k, v]) => (html[k] = v));
  }
  await b.close();
  const list = [...keys].filter((k) => han.test(k)).sort();
  // 用英文模式加载词典，检查每一条界面文字都有英文、占位符一致
  const ectx = { navigator: { language: 'en' } }; vm.createContext(ectx);
  vm.runInContext(fs.readFileSync(dir + 'i18n.js', 'utf8'), ectx);
  const skip = /^(下单|全部|售后|报价|样品|询盘|谈判) \d+$|^共 \d+ |^当前版本 v\d|^\d+ 字符$/;
  const missing = list.filter((k) => !skip.test(k) && !(k in ectx.TL_EN));
  const htmlMissing = Object.keys(html).filter((k) => !(k in ectx.TL_EN_HTML));
  const bad = Object.entries(ectx.TL_EN).filter(([z, e]) => (z.match(/\{\w+\}/g) || []).sort().join() !== (e.match(/\{\w+\}/g) || []).sort().join()).map(([z]) => z);
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ok(!missing.length, `所有界面文字都有英文（${list.length} 条）` + (missing.length ? '，缺：' + missing.join(' | ') : ''));
  ok(!htmlMissing.length, '带格式的段落都有英文' + (htmlMissing.length ? '，缺：' + htmlMissing.join(', ') : ''));
  ok(!bad.length, '中英文的占位符 {x} 一致' + (bad.length ? '，不一致：' + bad.join(' | ') : ''));
})();
