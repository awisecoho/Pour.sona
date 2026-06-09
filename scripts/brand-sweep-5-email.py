#!/usr/bin/env python3
"""Phase 5 brand sweep: email templates (lib/email.ts) -> Poursona v2.

Email-specific deviations from the app sweep:
  - Font uses a literal stack (Inter, 'Helvetica Neue', Arial, sans-serif),
    NOT var(--font-inter): mail clients don't resolve CSS variables.
  - #1a1108 (dark order-item text that sat on the dark card) -> cream for
    readability; #c8bfa8 tan list text -> Poursona muted; #f9f5ec page bg
    -> Poursona cream.
Status colors #5ecf8a / #e07070 are intentionally kept. CRLF preserved.
"""
import re
import sys

FILE = "lib/email.ts"

HEX_MAP = {
    "3FC6D4": "D67A31",  # teal -> copper amber
    "2A9BA8": "612A86",  # teal dim -> plum
    "0A0E15": "12111A",  # card bg
    "0C1018": "12111A",  # button text (near-black)
    "E8EDF2": "F5F2E8",  # textPrimary cream
    "3A4456": "3A3450",  # textFaint
    "2A3242": "3A3450",  # textFaint
    "f9f5ec": "F5F2E8",  # email page bg -> Poursona cream
    "1a1108": "F5F2E8",  # order-item text (was dark-on-dark) -> cream
    "c8bfa8": "A89FB8",  # muted list text
}

LITERAL_SUBS = [
    ("63,198,212", "97,42,134"),
    ("'Space Grotesk', sans-serif", "Inter, 'Helvetica Neue', Arial, sans-serif"),
    ("CuvAi", "Poursona"),
]


def main() -> int:
    with open(FILE, "r", encoding="utf-8", newline="") as fh:
        text = src = fh.read()
    n = 0
    for old, new in HEX_MAP.items():
        text, c = re.compile("#" + old, re.IGNORECASE).subn("#" + new, text)
        n += c
    for old, new in LITERAL_SUBS:
        c = text.count(old)
        text = text.replace(old, new)
        n += c
    if text != src:
        with open(FILE, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
    print(f"  {n} substitutions in {FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
