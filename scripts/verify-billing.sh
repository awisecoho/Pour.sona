#!/usr/bin/env bash
# Billing correctness verification. Exits non-zero on failed code-level checks.
# NOTE: that the *charged* amount equals $79 requires a live Stripe test-mode run
# and STRIPE_PRICE_STARTER pointing at a $79 price object — see evidence-checklist
# (tagged NOT VERIFIED; needs the owner's Stripe environment).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-billing] pure mapping unit tests"
npx vitest run tests/billing.test.ts

echo "[verify-billing] webhook verifies the Stripe signature"
grep -q "constructEvent" app/api/stripe/webhook/route.ts

echo "[verify-billing] webhook is replay-safe (idempotent dedupe)"
grep -q "stripe_webhook_events" app/api/stripe/webhook/route.ts
grep -q "ON CONFLICT (id) DO NOTHING" app/api/stripe/webhook/route.ts

echo "[verify-billing] dedupe table exists in the Neon migration"
grep -q "CREATE TABLE IF NOT EXISTS stripe_webhook_events" app/api/migrate/route.ts

echo "[verify-billing] starter MRR is \$79 in checkout + mapping"
grep -q "name: 'Starter', mrr: 79" app/api/stripe/checkout/route.ts
grep -q "starter: 79" lib/billing.ts

echo "[verify-billing] webhook uses the shared mapping (no inline drift)"
grep -q "planToMrr" app/api/stripe/webhook/route.ts

if [ -z "${STRIPE_PRICE_STARTER:-}" ]; then
  echo "[verify-billing] WARN: STRIPE_PRICE_STARTER not set in this shell — charged-amount check is NOT VERIFIED here"
fi

echo "[verify-billing] OK (code-level checks passed)"
