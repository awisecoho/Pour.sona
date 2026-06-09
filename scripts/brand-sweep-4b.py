#!/usr/bin/env python3
"""Phase 4b brand sweep: CuvAi-era palette -> Poursona v2 on internal admin pages.
Preserves CRLF line endings (newline='' on read+write). Case-insensitive on hex.
"""
import re
import sys

FILES = [
    "app/poursona-admin/team/page.tsx",
    "app/poursona-admin/onboard/page.tsx",
    "app/poursona-admin/retailer/[id]/page.tsx",
    "app/poursona-admin/system-check/page.tsx",
    "app/poursona-admin/_components/SocialAccounts.tsx",
]

# Hex substitutions (case-insensitive match, fixed-case output).
HEX_MAP = {
    "3FC6D4": "D67A31",  # teal primary -> copper amber
    "2A9BA8": "612A86",  # teal dim -> plum
    "0C1018": "12111A",  # bg
    "0A0E15": "12111A",  # bg
    "E8EDF2": "F5F2E8",  # textPrimary
    "8A95A5": "A89FB8",  # text scale
    "6B7588": "6A6080",  # text scale
    "3A4456": "3A3450",  # textFaint
    "2A3242": "3A3450",  # textFaint
    "161C28": "1C1A2A",  # card bg
    "10141D": "161423",  # card bg
}

# Literal substitutions (order matters: longer/font first).
LITERAL_SUBS = [
    ("63,198,212", "97,42,134"),                       # rgba plum chrome
    ("'Space Grotesk', sans-serif", "var(--font-inter), system-ui, sans-serif"),
    ("'Space Grotesk'", "var(--font-inter)"),          # any bare leftovers
    ("CuvAi", "Poursona"),
]


def sweep(text: str) -> tuple[str, int]:
    n = 0
    for old, new in HEX_MAP.items():
        pat = re.compile("#" + old, re.IGNORECASE)
        text, c = pat.subn("#" + new, text)
        n += c
    for old, new in LITERAL_SUBS:
        c = text.count(old)
        if c:
            text = text.replace(old, new)
            n += c
    return text, n


def main() -> int:
    total = 0
    for f in FILES:
        try:
            with open(f, "r", encoding="utf-8", newline="") as fh:
                src = fh.read()
        except FileNotFoundError:
            print(f"  MISSING  {f}")
            return 1
        out, n = sweep(src)
        if out != src:
            with open(f, "w", encoding="utf-8", newline="") as fh:
                fh.write(out)
        print(f"  {n:>4}  {f}")
        total += n
    print(f"  ----  total {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
