#!/usr/bin/env python3
"""csl-hash.py — ClearSale per-signal hash reproduction.

ClearSale's fp2.png "hashes" (ar/as/ay/h1/h4/h6/h7/az) are standard
MurmurHash3 x64_128 (== FingerprintJS x64hash128) of browser-enumerable
inputs. Verified: h6 == x64_128(UNMASKED_RENDERER_WEBGL, seed 0) byte-exact.

Usage:
  python3 csl-hash.py <string> [seed]
  python3 csl-hash.py --selftest
"""
import sys

M = (1 << 64) - 1

def rotl(x, r): return ((x << r) | (x >> (64 - r))) & M

def fmix(k):
    k ^= k >> 33; k = (k * 0xff51afd7ed558ccd) & M
    k ^= k >> 33; k = (k * 0xc4ceb9fe1a85ec53) & M
    k ^= k >> 33
    return k

def x64_128(s, seed=0):
    b = s.encode('utf-8')
    c1 = 0x87c37b91114253d5; c2 = 0x4cf5ad432745937f
    h1 = h2 = seed
    n = len(b) // 16 * 16
    for i in range(0, n, 16):
        k1 = int.from_bytes(b[i:i + 8], 'little')
        k2 = int.from_bytes(b[i + 8:i + 16], 'little')
        k1 = (k1 * c1) & M; k1 = rotl(k1, 31); k1 = (k1 * c2) & M; h1 ^= k1
        h1 = rotl(h1, 27); h1 = (h1 + h2) & M; h1 = (h1 * 5 + 0x52dce729) & M
        k2 = (k2 * c2) & M; k2 = rotl(k2, 33); k2 = (k2 * c1) & M; h2 ^= k2
        h2 = rotl(h2, 31); h2 = (h2 + h1) & M; h2 = (h2 * 5 + 0x38495ab5) & M
    tail = b[n:]; k1 = k2 = 0
    for j, byte in enumerate(tail):
        if j < 8: k1 |= byte << (8 * j)
        else: k2 |= byte << (8 * (j - 8))
    if len(tail) > 8:
        k2 = (k2 * c2) & M; k2 = rotl(k2, 33); k2 = (k2 * c1) & M; h2 ^= k2
    if tail:
        k1 = (k1 * c1) & M; k1 = rotl(k1, 31); k1 = (k1 * c2) & M; h1 ^= k1
    h1 ^= len(b); h2 ^= len(b)
    h1 = (h1 + h2) & M; h2 = (h2 + h1) & M
    h1 = fmix(h1); h2 = fmix(h2)
    h1 = (h1 + h2) & M; h2 = (h2 + h1) & M
    return f"{h1:016x}{h2:016x}"

if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == '--selftest':
        # h6 shipped by the engine for this renderer (captured live)
        r = "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
        got = x64_128(r, 0)
        want = "997d578bfe7c39526994fe6568323d90"
        print("renderer:", r)
        print("computed h6:", got)
        print("shipped  h6:", want)
        print("MATCH:", got == want)
        print("empty string:", x64_128(''))   # MurmurHash3 vector -> all zeros
    elif len(sys.argv) >= 2:
        seed = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        print(x64_128(sys.argv[1], seed))
    else:
        print(__doc__)
