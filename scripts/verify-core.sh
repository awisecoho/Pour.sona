#!/usr/bin/env bash
# Core verification: encoding guard, typecheck, unit tests. Exits non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-core] 1/3 encoding guard"
node scripts/check-encoding.js

echo "[verify-core] 2/3 typecheck"
npx tsc --noEmit

echo "[verify-core] 3/3 unit tests"
npx vitest run

echo "[verify-core] OK"
