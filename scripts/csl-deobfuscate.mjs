#!/usr/bin/env node
/** csl-deobfuscate.mjs — extract + decode the obfuscator.io string table from
 *  ClearSale's fp.js (device.clearsale.com.br/p/fp.js, sdk v=1.0.255).
 *  Replicates the shuffle checksum (target 0xd5fbb) so indices line up.
 *  Usage: node csl-deobfuscate.mjs fp.js [out-prefix] */
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2] || 'fp.js';
const pre = process.argv[3] || 'fp';
let s = readFileSync(src, 'utf-8');

const startMark = "var _0x30e2a4=['";
const start = s.indexOf(startMark);
const endMark = "'];a0_0x3cfe=function(){return _0x30e2a4;}";
const end = s.indexOf(endMark);
if (start < 0 || end < 0) { console.error('string-array pattern not found'); process.exit(1); }

const lit = s.slice(start + startMark.length, end);
const arr = lit.split("','").map(x => x.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
const dec = (idx) => arr[idx - 0x1c4];

// shuffle loop (checksum expression copied from the bundle)
const chk = () => -parseInt(dec(0x208))/0x1*(-parseInt(dec(0x34e))/0x2)+parseInt(dec(0x50f))/0x3
  + -parseInt(dec(0x451))/0x4*(-parseInt(dec(0x408))/0x5)+-parseInt(dec(0x3ec))/0x6
  + parseInt(dec(0x26a))/0x7*(parseInt(dec(0x3d6))/0x8)+parseInt(dec(0x44a))/0x9
  * (-parseInt(dec(0x36c))/0xa)+-parseInt(dec(0x4c1))/0xb;
let steps = 0;
for (;;) {
  try { if (chk() === 0xd5fbb) break; arr.push(arr.shift()); }
  catch (_) { arr.push(arr.shift()); }
  if (++steps > 200000) { console.error('shuffle runaway'); process.exit(1); }
}

const strings = [];
for (let idx = 0; idx < 0x3000; idx++) {
  try { const v = dec(idx); if (typeof v === 'string' && v) strings.push(v); } catch (_) {}
}
writeFileSync(pre + '-strings.txt', strings.map(v => JSON.stringify(v)).join('\n'));

// decode a0_0x163e(0xNNN) calls across the source
let decSrc = s.replace(/a0_0x163e\((0x[0-9a-f]+)\)/g, (m, idx) => {
  const v = dec(parseInt(idx, 16));
  return typeof v === 'string' ? JSON.stringify(v) : m;
});
writeFileSync(pre + '-decoded.js', decSrc);

console.log(`items=${arr.length}  shuffle=${steps}  strings=${strings.length}`);
console.log(`wrote ${pre}-strings.txt and ${pre}-decoded.js`);
