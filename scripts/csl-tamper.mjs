#!/usr/bin/env node
/** csl-tamper.mjs — rewrite ClearSale's fingerprint GETs mid-flight:
 *   tamper: flip fp2.png plaintext params (UA/screen/flags) + fp1.png values
 *   mint:   pre-seed forged __udf_j cookie + __udf_l localStorage, ship verbatim
 *  Record every server response to prove acceptance. */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

const APPKEY = 'r3j6a9f10bmssayw2thp';
const MODE = process.argv[2] || 'tamper';
const OUT = `/tmp/opencode/clearsale/${MODE}`;
mkdirSync(OUT, { recursive: true });
const SESSION = `csl-${MODE}-` + Math.random().toString(36).slice(2, 10);

const FORGED_BA = 'ff'.repeat(64);               // 128 hex cookie value
const FORGED_BB = 'aa'.repeat(64);               // 128 hex localStorage value

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><body>
<script>
${MODE === 'mint' ? `
document.cookie = '__udf_j=${FORGED_BA};path=/;SameSite=Lax';
localStorage.setItem('__udf_l', '${FORGED_BB}');
` : ''}
(function (a, b, c, d, e, f, g) {
  a['CsdpObject'] = e; a[e] = a[e] || function () {
  (a[e].q = a[e].q || []).push(arguments)
  }, a[e].l = 1 * new Date(); f = b.createElement(c),
  g = b.getElementsByTagName(c)[0]; f.async = 1; f.src = d; g.parentNode.insertBefore(f, g)
})(window, document, 'script', 'https://device.clearsale.com.br/p/fp.js', 'csdp');
csdp('app', '${APPKEY}');
csdp('sessionid', '${SESSION}');
</script>
</body></html>`);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const sent = [];
const respLog = [];
let tampered = 0;

await page.route('**/*', async (route) => {
  const req = route.request();
  const u = req.url();
  if (/clearsale\.com\.br\/p\/fp[12]\.png/.test(u)) {
    let url = u;
    if (MODE === 'tamper') {
      // flip plaintext params + the sm flag + hash fields
      url = url
        .replace('aa=Mozilla%2F5.0%20(X11%3B%20Linux%20x86_64)', 'aa=FakeUA%20%2F%20Tampered')
        .replace('ab=en-US', 'ab=xx-XX')
        .replace('ae=900&af=1280', 'ae=1024&af=768')
        .replace('sm=true', 'sm=false');
      tampered++;
    }
    sent.push({ url: url, orig: u !== url });
    await route.continue({ url });
  } else {
    await route.continue();
  }
});

page.on('response', async (res) => {
  const u = res.url();
  if (/clearsale\.com\.br\/p\/(fp1|fp2|ci)\.png/.test(u)) {
    respLog.push({ status: res.status(), url: u.slice(0, 110) });
  }
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);

const state = await page.evaluate(() => ({
  udf_j_cookie: (document.cookie.match(/__udf_j=([^;]+)/) || [])[1] || '(none)',
  udf_l_storage: localStorage.getItem('__udf_l') || '(none)',
})).catch(e => ({ err: String(e).slice(0, 150) }));

const out = { mode: MODE, session: SESSION, tampered, sent, respLog, state };
writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 2));

console.log(`=== CLEARSALE ${MODE.toUpperCase()} (appkey ${APPKEY}) ===`);
console.log(`sessionid: ${SESSION}   tampered: ${tampered}`);
console.log('\nshipped (rewritten where marked):');
for (const s of sent) {
  const m = s.url.match(/\/p\/(fp[12])\.png/)[1];
  const parts = {};
  for (const kv of s.url.split('?')[1].split('&')) {
    const [k, v] = kv.split('=');
    parts[k] = (v || '').slice(0, 32);
  }
  const show = m === 'fp1' ? { bb: (parts.bb || '').slice(0, 16) + '...', ba: (parts.ba || '').slice(0, 16) + '...', a2: (parts.a2 || '').slice(0, 16) + '...', sm: parts.sm } : { aa: parts.aa, ab: parts.ab, ae: parts.ae, af: parts.af, sm: parts.sm };
  console.log(`  ${m}.png changed=${s.orig} ${JSON.stringify(show)}`);
}
console.log('\nresponses:');
for (const r of respLog) console.log(`  ${r.status} ${r.url}`);
console.log('\nbrowser state:');
console.log(JSON.stringify(state, null, 2));
srv.close(); await b.close();
