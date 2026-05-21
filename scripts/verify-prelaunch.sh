#!/usr/bin/env bash
# Pre-launch security checklist. Exits non-zero on any failed check.
# Run before deploying to first paying customer.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-prelaunch] 1/5 PII leak: /api/retailer uses column whitelist, not SELECT *"
grep -q "PUBLIC_COLS" app/api/retailer/route.ts
# Confirm the dangerous fields are absent from the select list
if grep -q "owner_email\|stripe_customer_id\|ai_input_tokens\|chat_system_prompt\|subscription_status" \
   <(grep "PUBLIC_COLS" app/api/retailer/route.ts | head -1); then
  echo "[verify-prelaunch] FAIL: sensitive column found in PUBLIC_COLS definition"; exit 1
fi
# Confirm no bare SELECT * from retailers remains (flights SELECT * is fine)
if grep -q "select \* from retailers" app/api/retailer/route.ts; then
  echo "[verify-prelaunch] FAIL: bare SELECT * from retailers still in /api/retailer"; exit 1
fi

echo "[verify-prelaunch] 2/5 SSRF: /api/signup/url uses validateScrapeUrl (not inline blocklist)"
grep -q "validateScrapeUrl" app/api/signup/url/route.ts
# Confirm the old partial-blocklist pattern is gone
if grep -q "192\.168\." app/api/signup/url/route.ts; then
  echo "[verify-prelaunch] FAIL: old inline SSRF blocklist still present in /api/signup/url"; exit 1
fi

echo "[verify-prelaunch] 3/5 rate limit: /api/order is in middleware LIMITS map"
grep -q "'/api/order'" middleware.ts

echo "[verify-prelaunch] 4/5 CTA: no stale 'Get Early Access' on marketing page"
if grep -q "Get Early Access" app/page.tsx; then
  echo "[verify-prelaunch] FAIL: stale 'Get Early Access' CTA still present in app/page.tsx"; exit 1
fi
grep -q "Start Free Trial" app/page.tsx

echo "[verify-prelaunch] 5/5 contrast: failing dark body color #4a3a1a removed from marketing pages"
for f in app/page.tsx app/pricing/page.tsx; do
  if grep -q "#4a3a1a\|#3a2a0a" "$f"; then
    echo "[verify-prelaunch] FAIL: low-contrast color still in $f"; exit 1
  fi
done

echo "[verify-prelaunch] running SSRF unit tests"
npx vitest run tests/security.test.ts

echo "[verify-prelaunch] OK — all 5 pre-launch checks passed"
echo ""
echo "  Items still requiring owner action (NOT automated):"
echo "  - [ ] Switch Clerk to production tenant (pk_live_*)"
echo "  - [ ] Verify STRIPE_PRICE_STARTER resolves to a \$79/month recurring price"
echo "  - [ ] Add magic-link email verification before publishDraft (post-launch roadmap)"
