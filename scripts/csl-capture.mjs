#!/usr/bin/env node
/** csl-capture.mjs — drive ClearSale's REAL fingerprint engine (device.clearsale.com.br/p/fp.js)
 *  with the PUBLIC sandbox appkey (r3j6a9f10bmssayw2thp) and a client-chosen sessionid.
 *  Capture every request/payload the engine ships + browser state. */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

const APPKEY = 'r3j6a9f10bmssayw2thp';   // ClearSale public sandbox appkey (from their docs)
const SESSION = 'csl-redteam-' + Math.random().toString(36).slice(2, 10);
const OUT = '/tmp/opencode/clearsale/cap';
mkdirSync(OUT, { recursive: true });

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><body>
<script>
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

const reqs = [];
page.on('request', (req) => {
  const u = req.url();
  if (!/clearsale|fpcs/.test(u)) return;
  let body = null; try { body = req.postData(); } catch (_) {}
  reqs.push({ t: 'REQ', m: req.method(), u, body: body || null, bodyLen: body ? body.length : 0 });
});
page.on('response', async (res) => {
  const u = res.url();
  if (!/clearsale|fpcs/.test(u)) return;
  let len = 0, head = '';
  try { const buf = await res.body(); len = buf.length; head = buf.slice(0, 300).toString('latin1'); } catch (_) {}
  reqs.push({ t: 'RES', status: res.status(), type: res.headers()['content-type'] || '', u, len, head,
              setCookie: res.headers()['set-cookie'] || null });
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);

const state = await page.evaluate(() => ({
  csdpQueue: window.csdp ? window.csdp.q || [] : null,
  cookies: document.cookie.slice(0, 300),
  csdpEl: !!document.querySelector('script[src*="fp.js"]'),
  iframes: [...document.querySelectorAll('iframe')].map(f => f.src),
})).catch(e => ({ err: String(e).slice(0, 200) }));

writeFileSync(`${OUT}/requests.json`, JSON.stringify(reqs, null, 2));
writeFileSync(`${OUT}/state.json`, JSON.stringify(state, null, 2));

console.log('=== CLEARSALE FINGERPRINT CAPTURE (sandbox appkey ' + APPKEY + ') ===');
console.log('sessionid:', SESSION);
console.log('');
for (const r of reqs) {
  if (r.t === 'RES') console.log(`RES ${r.status} ${r.len}B [${r.type}] ${r.u}`);
  else console.log(`${r.m} ${r.u} ${r.body ? `body=${r.bodyLen}B` : ''}`);
}
console.log('\nstate:', JSON.stringify(state, null, 2).slice(0, 800));
srv.close(); await b.close();
