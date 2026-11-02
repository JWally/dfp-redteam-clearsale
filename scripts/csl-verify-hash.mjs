#!/usr/bin/env node
/** csl-verify-hash.mjs — prove ClearSale's per-signal hashes are the PUBLIC
 *  FingerprintJS x64hash128(input, seed=31). Load the real engine in Chrome,
 *  read the raw WebGL renderer + speech-voice list + fonts, recompute the
 *  hashes locally, and compare to what the engine actually shipped. */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

const APPKEY = 'r3j6a9f10bmssayw2thp';
const OUT = '/tmp/opencode/clearsale/verify';
mkdirSync(OUT, { recursive: true });

// ---- FingerprintJS x64hash128 (public, MIT) ----
function x64Add(m, n) {
  m = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
  n = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
  const o = [0, 0, 0, 0];
  o[3] += m[3] + n[3]; o[2] += o[3] >>> 16; o[3] &= 0xffff;
  o[2] += m[2] + n[2]; o[1] += o[2] >>> 16; o[2] &= 0xffff;
  o[1] += m[1] + n[1]; o[0] += o[1] >>> 16; o[1] &= 0xffff;
  o[0] += m[0] + n[0]; o[0] &= 0xffff;
  return [(o[0] << 16) | o[1], (o[2] << 16) | o[3]];
}
function x64Multiply(m, n) {
  m = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
  n = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
  const o = [0, 0, 0, 0];
  o[3] += m[3] * n[3]; o[2] += o[3] >>> 16; o[3] &= 0xffff;
  o[2] += m[2] * n[3]; o[1] += o[2] >>> 16; o[2] &= 0xffff;
  o[2] += m[3] * n[2]; o[1] += o[2] >>> 16; o[2] &= 0xffff;
  o[1] += m[1] * n[3]; o[0] += o[1] >>> 16; o[1] &= 0xffff;
  o[1] += m[2] * n[2]; o[0] += o[1] >>> 16; o[1] &= 0xffff;
  o[1] += m[3] * n[1]; o[0] += o[1] >>> 16; o[1] &= 0xffff;
  o[0] += m[0] * n[3] + m[1] * n[2] + m[2] * n[1] + m[3] * n[0];
  o[0] &= 0xffff;
  return [(o[0] << 16) | o[1], (o[2] << 16) | o[3]];
}
function x64Fmix(h) {
  h = x64Xor(h, [0, h[0] >>> 1]);
  h = x64Multiply(h, [0xff51afd7, 0xed558ccd]);
  h = x64Xor(h, [0, h[0] >>> 1]);
  h = x64Multiply(h, [0xc4ceb9fe, 0x1a85ec53]);
  h = x64Xor(h, [0, h[0] >>> 1]);
  return h;
}
function x64Xor(m, n) { return [m[0] ^ n[0], m[1] ^ n[1]]; }
function x64hash128(key, seed) {
  key = key || ''; seed = seed || 0;
  const remainder = key.length % 16;
  const bytes = key.length - remainder;
  let h1 = [0, seed], h2 = [0, seed];
  let k1, k2;
  const c1 = [0x87c37b91, 0x114253d5], c2 = [0x4cf5ad43, 0x2745937f];
  for (let i = 0; i < bytes; i += 16) {
    k1 = [(key.charCodeAt(i) & 0xff) | ((key.charCodeAt(i + 1) & 0xff) << 8) | ((key.charCodeAt(i + 2) & 0xff) << 16) | ((key.charCodeAt(i + 3) & 0xff) << 24),
          (key.charCodeAt(i + 4) & 0xff) | ((key.charCodeAt(i + 5) & 0xff) << 8) | ((key.charCodeAt(i + 6) & 0xff) << 16) | ((key.charCodeAt(i + 7) & 0xff) << 24)];
    k2 = [(key.charCodeAt(i + 8) & 0xff) | ((key.charCodeAt(i + 9) & 0xff) << 8) | ((key.charCodeAt(i + 10) & 0xff) << 16) | ((key.charCodeAt(i + 11) & 0xff) << 24),
          (key.charCodeAt(i + 12) & 0xff) | ((key.charCodeAt(i + 13) & 0xff) << 8) | ((key.charCodeAt(i + 14) & 0xff) << 16) | ((key.charCodeAt(i + 15) & 0xff) << 24)];
    k1 = x64Multiply(k1, c1); k1 = x64Rotl(k1, 31); k1 = x64Multiply(k1, c2);
    h1 = x64Xor(h1, k1); h1 = x64Rotl(h1, 27); h1 = x64Add(h1, h2); h1 = x64Add(x64Multiply(h1, [0, 5]), [0, 0x52dce729]);
    k2 = x64Multiply(k2, c2); k2 = x64Rotl(k2, 33); k2 = x64Multiply(k2, c1);
    h2 = x64Xor(h2, k2); h2 = x64Rotl(h2, 31); h2 = x64Add(h2, h1); h2 = x64Add(x64Multiply(h2, [0, 5]), [0, 0x38495ab5]);
  }
  k1 = [0, 0]; k2 = [0, 0];
  const i = bytes;
  switch (remainder) {
    case 15: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 14)], 48));
    case 14: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 13)], 40));
    case 13: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 12)], 32));
    case 12: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 11)], 24));
    case 11: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 10)], 16));
    case 10: k2 = x64Xor(k2, x64LeftShift([0, key.charCodeAt(i + 9)], 8));
    case 9: k2 = x64Xor(k2, [0, key.charCodeAt(i + 8)]);
      k2 = x64Multiply(k2, [0x4cf5ad43, 0x2745937f]); k2 = x64Rotl(k2, 33); k2 = x64Multiply(k2, [0x87c37b91, 0x114253d5]); h2 = x64Xor(h2, k2);
    case 8: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 7)], 56));
    case 7: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 6)], 48));
    case 6: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 5)], 40));
    case 5: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 4)], 32));
    case 4: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 3)], 24));
    case 3: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 2)], 16));
    case 2: k1 = x64Xor(k1, x64LeftShift([0, key.charCodeAt(i + 1)], 8));
    case 1: k1 = x64Xor(k1, [0, key.charCodeAt(i)]);
      k1 = x64Multiply(k1, [0x87c37b91, 0x114253d5]); k1 = x64Rotl(k1, 31); k1 = x64Multiply(k1, [0x4cf5ad43, 0x2745937f]); h1 = x64Xor(h1, k1);
  }
  h1 = x64Xor(h1, [0, key.length]); h2 = x64Xor(h2, [0, key.length]);
  h1 = x64Add(h1, h2); h2 = x64Add(h2, h1);
  h1 = x64Fmix(h1); h2 = x64Fmix(h2);
  h1 = x64Add(h1, h2); h2 = x64Add(h2, h1);
  return ('00000000' + (h1[0] >>> 0).toString(16)).slice(-8) + ('00000000' + (h1[1] >>> 0).toString(16)).slice(-8)
       + ('00000000' + (h2[0] >>> 0).toString(16)).slice(-8) + ('00000000' + (h2[1] >>> 0).toString(16)).slice(-8);
}
function x64LeftShift(m, n) { n %= 64; if (n === 0) return m; if (n < 32) return [(m[0] << n) | (m[1] >>> (32 - n)), m[1] << n]; return [m[1] << (n - 32), 0]; }
function x64Rotl(m, n) { n %= 64; if (n === 32) return [m[1], m[0]]; if (n < 32) return [(m[0] << n) | (m[1] >>> (32 - n)), (m[1] << n) | (m[0] >>> (32 - n))]; m = x64Rotl(m, 32); return [(m[0] << (n - 32)) | (m[1] >>> (64 - n)), (m[1] << (n - 32)) | (m[0] >>> (64 - n))]; }

// sanity: FingerprintJS canonical vector
console.log('x64hash128("hello") sanity =', x64hash128('hello'));

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><body>
<script>
(function (a,b,c,d,e,f,g){a['CsdpObject']=e;a[e]=a[e]||function(){(a[e].q=a[e].q||[]).push(arguments)},a[e].l=1*new Date();f=b.createElement(c),g=b.getElementsByTagName(c)[0];f.async=1;f.src=d;g.parentNode.insertBefore(f,g)})(window,document,'script','https://device.clearsale.com.br/p/fp.js','csdp');
csdp('app','${APPKEY}'); csdp('sessionid','verify-hash-${Date.now()}');
</script></body></html>`);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const shipped = {};
page.on('request', (req) => {
  const u = req.url();
  if (/fp2\.png/.test(u)) {
    for (const kv of u.split('?')[1].split('&')) { const [k, v] = kv.split('='); if (k) shipped[k] = decodeURIComponent(v || ''); }
  }
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);

// read raw sources in the same browser
const raw = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
  const exts = gl ? gl.getSupportedExtensions() : [];
  return { renderer, vendor, exts };
});

console.log('\n=== VERIFY h6 = x64hash128(UNMASKED_RENDERER_WEBGL, seed) ===');
console.log('raw renderer :', raw.renderer);
console.log('shipped h6   :', shipped.h6);
console.log('computed seed0 :', x64hash128(raw.renderer, 0));
console.log('computed seed31:', x64hash128(raw.renderer, 31));
console.log('MATCH (seed0)  :', x64hash128(raw.renderer, 0) === shipped.h6);
console.log('MATCH (seed31) :', x64hash128(raw.renderer, 31) === shipped.h6);

writeFileSync(OUT + '/verify.json', JSON.stringify({ raw, shipped, computed_seed0: x64hash128(raw.renderer, 0), computed_seed31: x64hash128(raw.renderer, 31) }, null, 2));
console.log('\n=== shipped params ===');
console.log(JSON.stringify(shipped, null, 2));
srv.close(); await b.close();
