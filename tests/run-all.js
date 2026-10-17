// 运行全部测试：node tests/run-all.js            （需要先在 tests/ 里 npm install）
// 只跑部分：node tests/run-all.js deal notion
// 提醒相关的测试按“今天 10:30”构造数据，所以统一在一个当地时间约为中午的时区里运行，避免深夜跑测试时误报。
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
fs.mkdirSync(path.join(os.tmpdir(), 'tradelingo-test-shots'), { recursive: true });
const ORDER = ['background', 'reminders', 'update-check', 'notion-sync', 'i18n-coverage', 'toolbar', 'lexical-input', 'chat-language', 'deal-card', 'followup-page',
  'deal-card-edits', 'sidebar-unread', 'backup', 'wizard-settings', 'english-ui', 'notion-settings', 'phrases-captions'];
const filter = process.argv.slice(2);
const all = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).map((f) => f.replace('.test.js', ''));
const list = [...ORDER.filter((n) => all.includes(n)), ...all.filter((n) => !ORDER.includes(n))].filter((n) => !filter.length || filter.some((x) => n.includes(x)));
const off = ((12 - new Date().getUTCHours()) % 24 + 24) % 24;
const shift = off > 12 ? off - 24 : off;               // 让当地时间约为 12 点
const TZ = shift === 0 ? 'Etc/GMT' : `Etc/GMT${shift > 0 ? '-' : '+'}${Math.abs(shift)}`;
let pass = 0, fail = 0;
for (const name of list) {
  const r = spawnSync(process.execPath, [path.join(__dirname, name + '.test.js')], { cwd: __dirname, env: { ...process.env, TZ }, encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const p = (out.match(/^PASS /gm) || []).length;
  const f = (out.match(/^FAIL /gm) || []).length + (r.status && !/^FAIL /m.test(out) ? 1 : 0);
  pass += p; fail += f;
  console.log(`${f ? '✗' : '✓'} ${name.padEnd(18)} ${p} pass${f ? `, ${f} fail` : ''}`);
  if (f) console.log(out.split('\n').filter((l) => /^FAIL |Error|errors \[.+\]/.test(l)).slice(0, 8).map((l) => '    ' + l).join('\n'));
}
console.log(`\n共 ${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
