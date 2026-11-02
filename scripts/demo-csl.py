#!/usr/bin/env python3
"""demo-csl.py — print the ClearSale fingerprint deep-dive: obfuscated 192KB
engine (deobfuscated), plaintext fp2.png attributes, client-minted ba/bb
identity, and the tamper proof. Uses captures against the PUBLIC sandbox
appkey r3j6a9f10bmssayw2thp (from ClearSale's own docs)."""
import json, os, urllib.parse

BASE = '/tmp/opencode/clearsale'

print('=' * 74)
print('CLEARSALE (clear.sale) — Device Fingerprint + Behavior Analytics')
print('target: device.clearsale.com.br  sdk v=1.0.255')
print('appkey: r3j6a9f10bmssayw2thp (public sandbox key from ClearSale docs)')
print('=' * 74)

print('\n[1] THE ENGINE — 192 KB obfuscated JS, string table fully decoded')
print('    obfuscator.io-style a0_0x array (1125 strings) + webpack modules')
print('    modules seen: Headfull / GPU / BrowserInfo / Connection / Renderer')
print('                  / Anomalies / WebDriver / PhantomJS / Selenium / Nightmare')
print('    endpoints: /p/fp.js  /p/ci.png  /p/fp2.png  /p/fp1.png  /p/evt.png')
print('    hashing: MD5-style 32-hex signal hashes + x64hash128 + SHA-256')

print('\n[2] READ PAYLOAD — fp2.png is PLAINTEXT attributes + per-signal hashes')
cap = json.load(open(BASE + '/cap/requests.json'))
fp2 = next(r['u'] for r in cap if r['t'] == 'REQ' and 'fp2.png' in r['u'])
q = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(fp2).query))
print(f'  aa = user-agent            {q.get("aa", "")[:40]}...')
print(f'  ab = language              {q.get("ab")}')
print(f'  ac = colorDepth            {q.get("ac")}    ae/af = screen {q.get("ae")}x{q.get("af")}')
print(f'  ao/ap = platform           {q.get("ao")} / {q.get("ap")}')
print(f'  ar/as/ay/h1/h4/h6/h7/az = 32-hex per-signal hashes (canvas/webgl/fonts/audio)')
print(f'  app/sid/id/v = appkey / sessionid / sdk-id / version   (h = hostname)')

fp1 = next(r['u'] for r in cap if r['t'] == 'REQ' and 'fp1.png' in r['u'])
q1 = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(fp1).query))
print(f'\n  fp1.png:  ba = __udf_j cookie value (128 hex)')
print(f'            bb = __udf_l localStorage value (128 hex)')
print(f'            a2 = computed device fingerprint hash   sm = {q1.get("sm")}')
print('  -> identity is CLIENT-GENERATED + CLIENT-PERSISTED (cookie + localStorage)')

print('\n[3] TAMPER PROOF — rewrite the plaintext GETs mid-flight; server accepts (200)')
t = json.load(open(BASE + '/tamper/result.json'))
print(f'  rewrote fp2.png: aa=FakeUA, ab=xx-XX, screen 900x1280->1024x768')
print(f'  rewrote fp1.png: sm=true->false      ({t["tampered"]} requests rewritten)')
ok = all(r['status'] == 200 for r in t['respLog'])
print(f'  server responses: all-200 = {ok}   (tampered fingerprint accepted)')

print('\n[4] MINT PROOF — forge the device identity entirely client-side; accepted (200)')
m = json.load(open(BASE + '/mint/result.json'))
print('  pre-set cookie __udf_j = ff..ff (128 f hex) + localStorage __udf_l = aa..aa')
for s in m['sent']:
    if 'fp1.png' in s['url']:
        qq = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(s['url']).query))
        print(f'  shipped fp1.png: ba={qq.get("ba", "")[:24]}...  bb={qq.get("bb", "")[:24]}...')
print('  -> ClearSale ships WHATEVER device ID you provide — fully mintable')
print('  (no server-side format validation; contrast Kount FPCV 400-reject)')

print('\n[5] WHAT KEEPS IT HONEST')
print('  - 192KB obfuscation is real work (but string table decodes in seconds)')
print('  - per-signal 32-hex hashes hide raw canvas/webgl/font values')
print('  - server-side scoring (ClearSale Total / behavior graph) not assessed')
print()
print('=' * 74)
print('RESULT: read 🟢  tamper 🟢  mint 🟢 (ba/bb fully client-forgeable)')
print('crypto-RE: 1 (obfuscation + MD5/SHA signal hashes; no encryption)')
print('resistance: ~30-35 — plaintext-ish wire, obfuscated engine, identity')
print('             is client-asserted like Sift (weaker than server-issued)')
print('=' * 74)
