#!/usr/bin/env bash
# RBAC + tenant isolation verification. Exits non-zero on failed checks.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-rbac] role hierarchy unit tests"
npx vitest run tests/authz.test.ts

echo "[verify-rbac] sensitive endpoints enforce role server-side"
# Billing changes are owner-only.
grep -q "authorizeRetailer(retailerId, 'owner')" app/api/stripe/checkout/route.ts
# Venue settings edits require manager or higher.
grep -q "authorizeRetailer(retailerId, 'manager')" app/api/admin/retailer/route.ts
# Flight mutations require manager or higher (POST/PUT/DELETE).
mgr_count=$(grep -c "ensureRetailerAccess(retailerId, 'manager')" app/api/admin/flights/route.ts || true)
if [ "$mgr_count" -lt 3 ]; then
  echo "[verify-rbac] FAIL: expected 3 manager-gated flight mutations, found $mgr_count"; exit 1
fi

echo "[verify-rbac] tenant scoping: authz resolves access via getRetailersForIdentity"
grep -q "getRetailersForIdentity" lib/authz.ts

echo "[verify-rbac] OK"
