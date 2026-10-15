/* TradeLingo website: language switch, screenshot zoom, translation demo, copy buttons. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'tl-lang';

  // Chinese title/description come from the HTML; English ones from data attributes on <html>.
  var meta = {
    zh: { title: document.title, desc: getMeta('description') },
    en: { title: root.getAttribute('data-title-en') || document.title, desc: root.getAttribute('data-desc-en') || getMeta('description') }
  };

  function getMeta(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute('content') : '';
  }
  function setMeta(sel, value) {
    var m = document.querySelector(sel);
    if (m && value) m.setAttribute('content', value);
  }

  function apply(lang) {
    var en = lang === 'en';
    root.lang = en ? 'en' : 'zh-CN';
    var m = en ? meta.en : meta.zh;
    document.title = m.title;
    setMeta('meta[name="description"]', m.desc);
    setMeta('meta[property="og:title"]', m.title);
    setMeta('meta[property="og:description"]', m.desc);
    document.querySelectorAll('.lang-toggle').forEach(function (b) {
      b.setAttribute('aria-label', en ? '切换到中文' : 'Switch to English');
    });
    document.querySelectorAll('[data-alt-zh]').forEach(function (img) {
      img.alt = en ? img.getAttribute('data-alt-en') : img.getAttribute('data-alt-zh');
    });
  }

  apply(root.lang === 'en' ? 'en' : 'zh');

  document.querySelectorAll('.lang-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.lang === 'en' ? 'zh' : 'en';
      try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked: switch for this visit only */ }
      apply(next);
    });
  });

  // ---- Screenshot zoom ----
  var dlg = document.querySelector('dialog.lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var big = dlg.querySelector('img');
    var cap = dlg.querySelector('p');
    document.querySelectorAll('.zoom').forEach(function (z) {
      z.addEventListener('click', function (ev) {
        ev.preventDefault();
        var img = z.querySelector('img');
        big.src = z.getAttribute('href') || img.src;
        big.alt = img.alt;
        cap.textContent = img.alt;
        dlg.showModal();
      });
    });
    dlg.querySelector('.close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg || ev.target === big) dlg.close(); });
  }

  // ---- Copy buttons (install page) ----
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () {
        btn.classList.add('done');
        var orig = btn.innerHTML;
        btn.innerHTML = root.lang === 'en' ? 'Copied' : '已复制';
        setTimeout(function () { btn.classList.remove('done'); btn.innerHTML = orig; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
      } else { fallback(text); done(); }
    });
  });
  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
    document.body.removeChild(ta);
  }

  // ---- Translation demo: cycles through three fictional customer messages ----
  var demo = document.querySelector('.demo');
  if (!demo) return;
  var samples = [
    { name: 'Al Noor Electrical', place: { zh: '迪拜（示例）', en: 'Dubai (sample)' }, color: '#00a884', letter: 'A',
      orig: 'الكمية 200 قطعة. ما هو السعر ومدة التسليم؟', dir: 'rtl',
      trans: '数量 200 台。价格和交期是多少？', engine: 'DeepL', cls: 'tag-deepl', time: '10:06' },
    { name: 'Almaty Energo', place: { zh: '阿拉木图（示例）', en: 'Almaty (sample)' }, color: '#7c5ce0', letter: 'A',
      orig: 'Сәлеметсіз бе! Контакторлардың бағасы қанша?', dir: 'ltr',
      trans: '您好！接触器的价格是多少？', engine: 'Qwen', cls: 'tag-qwen', time: '09:41' },
    { name: 'Dhaka Power Solutions', place: { zh: '达卡（示例）', en: 'Dhaka (sample)' }, color: '#f07b3f', letter: 'D',
      orig: 'আমাদের ATS দরকার', dir: 'ltr',
      trans: '我们需要 ATS', engine: 'Qwen', cls: 'tag-qwen', time: '11:20' }
  ];
  var el = {
    av: demo.querySelector('.avatar'), name: demo.querySelector('.d-name'),
    placeZh: demo.querySelector('.d-place [data-lang="zh"]'), placeEn: demo.querySelector('.d-place [data-lang="en"]'),
    orig: demo.querySelector('.orig'), trans: demo.querySelector('.trans'),
    text: demo.querySelector('.t-text'), tag: demo.querySelector('.trans .tag'), time: demo.querySelector('.bubble time'),
    dots: demo.querySelectorAll('.dots button')
  };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var i = 0, timer = null, inner = null;

  function show(n) {
    var s = samples[n];
    i = n;
    el.av.style.background = s.color; el.av.textContent = s.letter;
    el.name.textContent = s.name;
    el.placeZh.textContent = s.place.zh; el.placeEn.textContent = s.place.en;
    el.orig.textContent = s.orig; el.orig.setAttribute('dir', s.dir);
    el.orig.setAttribute('lang', ['ar', 'kk', 'bn'][n]);
    el.text.textContent = s.trans;
    el.tag.textContent = s.engine; el.tag.className = 'tag ' + s.cls;
    el.time.textContent = s.time;
    el.dots.forEach(function (d, k) { d.setAttribute('aria-current', k === n ? 'true' : 'false'); });
    if (reduce) { el.trans.classList.remove('hide'); return; }
    el.trans.classList.add('hide');
    clearTimeout(inner);
    inner = setTimeout(function () { el.trans.classList.remove('hide'); }, 900);
  }
  function loop() {
    clearInterval(timer);
    if (reduce) return;
    timer = setInterval(function () { show((i + 1) % samples.length); }, 4200);
  }
  el.dots.forEach(function (d, k) {
    d.addEventListener('click', function () { show(k); loop(); });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clearInterval(timer); else loop();
  });
  show(0);
  loop();
})();
