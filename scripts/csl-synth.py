#!/usr/bin/env python3
"""csl-synth.py — synthesize a fully COHERENT ClearSale fp2.png parameter set
for an arbitrary fake device, computing the per-signal hashes with the verified
MurmurHash3 x64_128. Writes the URL query to csl-synth-fp2.txt and prints it.

Proves: (a) every hashed field is reproducible offline from enumerable inputs,
(b) a synthesized fingerprint cannot be distinguished by the collector, because
only the hash travels (no plaintext to cross-check)."""
import sys, json, importlib.util
_spec = importlib.util.spec_from_file_location("csl_hash", "/home/justin/Dev/ms-argus-attack-bots/bots/csl-hash.py")
_m = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_m)
x64_128 = _m.x64_128

FAKE_RENDERER = "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)"  # a device that isn't ours
FAKE_FONTS = ["Arial", "Calibri", "Cambria", "Segoe UI", "Tahoma", "Verdana"]

out = {
    "aa": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "ab": "en-US",
    "ac": "24", "ad": "1",
    "ae": "1080", "af": "1920", "ag": "1040", "ah": "1920", "ai": "0",
    "aj": "1", "ak": "1", "al": "1", "am": "0", "an": "0",
    "ao": "Win32", "ap": "Win32",
    "ar": x64_128(";".join(FAKE_FONTS), 31),          # synthesized font-ish hash (seed 31 family)
    "as": x64_128("synthesized-webgl-extension-list", 31),
    "at": "0",
    "ay": x64_128(";".join(FAKE_FONTS), 31),
    "a3": "16",          # hardwareConcurrency (plaintext)
    "m1": "0",
    "mb": "0",
    "mr": "8",           # deviceMemory (plaintext)
    "h1": x64_128("math-precision:synthesized", 31),
    "h6": x64_128(FAKE_RENDERER, 0),                  # <-- the real GPU-hash formula, fake GPU
    "h4": x64_128("|".join(["PDF Viewer", "Chrome PDF Viewer", "Chromium PDF Viewer"]), 0),
    "l1": "0",
    "im": "0",
    "b1": "1", "b2": "1",
    "az": x64_128("synthesized-audio-fp", 0),
}

if __name__ == '__main__':
    if '--selftest' in sys.argv:
        r = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
        print("h6 self-test:", x64_128(r, 0), "== 997d578bfe7c39526994fe6568323d90 ->",
              x64_128(r, 0) == "997d578bfe7c39526994fe6568323d90")
    q = "&".join(f"{k}={v}" for k, v in out.items())
    open('/tmp/opencode/clearsale/csl-synth-fp2.txt', 'w').write(q)
    print("synthesized fp2.png query (fake RTX 4090 device):")
    print("  " + q)
    print("\n  h6 (renderer hash) =", out['h6'], "  <- computed, not captured")
    print("  written to /tmp/opencode/clearsale/csl-synth-fp2.txt")
