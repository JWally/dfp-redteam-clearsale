# ClearSale Device Fingerprint — client break (2026-11-02)

Full writeup of the authorized red-team against ClearSale's fingerprint SDK
(`@clear.sale/behavior-analytics-fingerprint-sdk` v1.0.255) using the **public
sandbox appkey** `r3j6a9f10bmssayw2thp` from ClearSale's own integration docs.
No customer/prod traffic.

## 1. Engine: 192 KB of obfuscator.io

`GET https://device.clearsale.com.br/p/fp.js` returns a 192,729-byte bundle:

- **obfuscator.io-style string array** — 1,125 strings behind the `a0_0x163e`
  decoder with a shift-shuffle checksum (`0xd5fbb`). Replicated the shuffle
  and decoded the whole table (`scripts/csl-deobfuscate.mjs`,
  `artifacts/string-table-decoded.txt`).
- **webpack-style modules** with readable class names: `Headfull`, `GPU`,
  `BrowserInfo`, `Connection`, `Renderer`, `Anomalies`, and an automation
  detector with `WebDriver` / `PhantomJS` / `Seleniun` / `Ninghtmare`
  (typos preserved from the bundle).
- **Hashing**: FingerprintJS-style `x64hash128`, `SHA-256`, plus the
  `WEBGL_debug_renderer_info` unmasked renderer probes and shader-precision
  probes. Also spotted: `AES-GCM`/`PBKDF2` (WebCrypto availability probes),
  canvas font-list probing (~100 font names), geolocation/battery/permissions
  capability probes, and an error beacon
  (`e.png?m=<error>&id=@clear.sale/...&v=1.0.255`).

## 2. The wire: plaintext image GETs

Collection runs as 1×1 image GETs to `device.clearsale.com.br/p/…`:

```
GET /p/ci.png                                cookie-capability pixel
GET /p/fp2.png?aa=<UA>&ab=<lang>&ac=<colorDepth>&ae/af=<screen>
             &ar=<h>&as=<h>&ay=<h>&h1..h7=<h>&az=<h>
             &app=<appkey>&sid=<sessionid>&id=@clear.sale/...&v=1.0.255&h=<host>
GET /p/fp1.png?bb=<localStorage GUID>&ba=<cookie GUID>&a2=<device hash>&sm=true
```

- `fp2.png` params `aa..aq` are **plaintext** (UA, language, color depth,
  screen dims, platform); `ar/as/ay/h1/h4/h6/h7/az` are 32-hex per-signal
  hashes (canvas / WebGL / fonts / audio etc.).
- `fp1.png` identity: `ba` = value of cookie `__udf_j` (128 hex), `bb` = value
  of localStorage `__udf_l` (128 hex), `a2` = async-computed aggregate device
  fingerprint hash, `sm=true` (SecureMode-ish flag).
- Cookies observed: `__udf_j` (device GUID, 1-year style), `__csfpsid_<n>` =
  base64(sessionid).

**Identity is client-minted.** The engine generates `ba`/`bb` itself on first
run (GUID generators in the decoded source: `_0x4587c0` for the cookie,
`_0x44fc9e` for localStorage) and persists them. `ci.png` sends **no**
Set-Cookie (verified) — the server does not issue the device ID.

## 3. Tamper — accepted (200)

Intercepted `fp2.png`/`fp1.png` via CDP and rewrote the plaintext params
mid-flight (`scripts/csl-tamper.mjs`):

```
aa=<real UA>       -> FakeUA / Tampered
ab=en-US           -> xx-XX
ae/af=900x1280     -> 1024x768
sm=true            -> false
```

All collector responses stayed **200** (`artifacts/tamper-result.json`) — the
collector accepts a tampered fingerprint.

## 4. Mint — device identity fully client-forgeable

Pre-seeded the browser before the SDK loaded:

```
document.cookie  = '__udf_j=' + 'ff'*64
localStorage     = '__udf_l=' + 'aa'*64
```

`fp1.png` shipped **verbatim**: `ba=ffff…ffff`, `bb=aaaa…aaaa`, server **200**
(`artifacts/mint-result.json`). No format/identity validation on the wire —
the device ID is whatever the client asserts. `sessionid` is client-chosen by
design (6–128 chars, joined to the order server-side).

## 5. Assessment

- **Crypto-RE: 1** — heavy obfuscation (seconds to decode the table), no
  encryption; signal hashes are MD5/SHA-256/x64hash128 of collected inputs.
- **Resistance: ~30-35** — readable + tamperable wire, fully client-mintable
  persistent identity (Sift-class, weaker than server-issued FPCV/`_vid_`).
  The moat is server-side ClearSale Total scoring + behavior graph on the
  client-asserted identity — not assessed (no merchant credentials).

## Scope note

Public sandbox appkey only; no customer/prod traffic; findings stated
honestly, never overstated.
