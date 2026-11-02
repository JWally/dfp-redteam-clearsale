#!/usr/bin/env node
/** csl-coherent.mjs — send a fully SYNTHESIZED COHERENT ClearSale fingerprint:
 *  replace fp2.png's device params with a fake RTX-4090 device whose hashes were
 *  computed offline (csl-synth.py), keeping the live session/appkey fields.
 *  Confirms the collector cannot distinguish a synthesized device (no plaintext
 *  to cross-check) -> 200. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const APPKEY = 'r3j6a9f10bmssayw2thp';
const OUT = '/tmp/opencode/clearsale/coherent';
mkdirSync(OUT, { recursive: true });

const synth = Object.fromEntries(readFileSync('/tmp/opencode/clearsale/csl-synth-fp2.txt', 'utf-8').trim().split('&').map(kv => kv.split('=')));

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><body>
<script>
(function (a,b,c,d,e,f,g){a['CsdpObject']=e;a[e]=a[e]||function(){(a[e].q=a[e].q||[]).push(arguments)},a[e].l=1*new Date();f=b.createElement(c),g=b.getElementsByTagName(c)[0];f.async=1;f.src=d;g.parentNode.insertBefore(f,g)})(window,document,'script','https://device.clearsale.com.br/p/fp.js','csdp');
csdp('app','${APPKEY}'); csdp('sessionid','coherent-${Date.now()}');
</script></body></html>`);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

let rewritten = null;
await page.route((url) => /fp2\.png/.test(url.toString()), async (route) => {
  const u = new URL(route.request().url());
  // overwrite device params with the synthesized coherent set, keep session fields
  for (const [k, v] of Object.entries(synth)) u.searchParams.set(k, v);
  rewritten = u.toString();
  await route.continue({ url: u.toString() });
});

const respLog = [];
page.on('response', async (res) => {
  if (/\/(fp1|fp2|ci)\.png/.test(res.url())) respLog.push({ status: res.status(), url: res.url().slice(0, 70) });
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);

writeFileSync(OUT + '/result.json', JSON.stringify({ rewritten, respLog }, null, 2));
console.log('=== CLEARSALE COHERENT SYNTHESIS ===');
console.log('sent fp2.png (synthesized fake RTX-4090 device):');
console.log('  ' + (rewritten || '(none)').slice(0, 200) + '...');
console.log('\nresponses:');
for (const r of respLog) console.log(`  ${r.status} ${r.url}`);
srv.close(); await b.close();
