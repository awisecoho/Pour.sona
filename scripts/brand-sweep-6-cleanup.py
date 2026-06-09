#!/usr/bin/env python3
"""Phase 6 cleanup: eradicate remaining CuvAi brand leaks the phase plan missed.

PALETTE files are full CuvAi-themed app surfaces (error pages + setup) -> get
the standard v2 hex map + Inter + name swap. TEXT_ONLY files are server logic /
comments / the sales-outreach prompt / scraper user-agents -> name swap only
(CuvAi -> Poursona, which also turns CuvAiBot -> PoursonaBot). CRLF preserved.
"""
import re
import sys

PALETTE = [
    "app/error.tsx",
    "app/r/[slug]/error.tsx",
    "app/poursona-admin/error.tsx",
    "app/setup/page.tsx",
]
TEXT_ONLY = [
    "app/api/poursona-admin/pipeline/route.ts",
    "app/api/signup/url/route.ts",
    "lib/onboarding.ts",
    "app/api/onboarding/url/route.ts",
    "app/api/poursona-admin/social/connect/[platform]/route.ts",
    "app/poursona-admin/_components/ProspectPipeline.tsx",
]

HEX_MAP = {
    "3FC6D4": "D67A31", "2A9BA8": "612A86", "0A0E15": "12111A", "0C1018": "12111A",
    "E8EDF2": "F5F2E8", "8A95A5": "A89FB8", "6B7588": "6A6080", "3A4456": "3A3450",
    "2A3242": "3A3450", "161C28": "1C1A2A", "10141D": "161423", "0F1B26": "1A1530",
}
PALETTE_LITERALS = [
    ("63,198,212", "97,42,134"),
    ("'Space Grotesk', sans-serif", "var(--font-inter), system-ui, sans-serif"),
    ("CuvAi", "Poursona"),
]


def sweep_palette(text):
    n = 0
    for old, new in HEX_MAP.items():
        text, c = re.compile("#" + old, re.IGNORECASE).subn("#" + new, text)
        n += c
    for old, new in PALETTE_LITERALS:
        c = text.count(old); text = text.replace(old, new); n += c
    return text, n


def sweep_text(text):
    c = text.count("CuvAi")
    return text.replace("CuvAi", "Poursona"), c


def run(files, fn):
    total = 0
    for f in files:
        with open(f, "r", encoding="utf-8", newline="") as fh:
            src = fh.read()
        out, n = fn(src)
        if out != src:
            with open(f, "w", encoding="utf-8", newline="") as fh:
                fh.write(out)
        print(f"  {n:>4}  {f}")
        total += n
    return total


def main():
    print("Palette files:")
    t1 = run(PALETTE, sweep_palette)
    print("Text-only files:")
    t2 = run(TEXT_ONLY, sweep_text)
    print(f"  ----  total {t1 + t2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
