#!/usr/bin/env bash
# AI budget + fallback verification. Exits non-zero on failed checks.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-ai-budget] unit tests (cost math, monthly window, fallback, in-stock)"
npx vitest run tests/chat-guardrails.test.ts

echo "[verify-ai-budget] chat route wires server-side budget enforcement"
grep -q "effectiveMonthlyUsage" app/api/chat/route.ts
grep -q "AI_MONTHLY_BUDGET_USD" app/api/chat/route.ts
grep -q "degradedResponse" app/api/chat/route.ts
# Over-budget path must return the fallback BEFORE constructing the Anthropic stream.
budget_line=$(grep -n "return degradedResponse" app/api/chat/route.ts | head -1 | cut -d: -f1)
stream_line=$(grep -n "anthropic.messages.stream" app/api/chat/route.ts | head -1 | cut -d: -f1)
if [ -z "$budget_line" ] || [ -z "$stream_line" ] || [ "$budget_line" -ge "$stream_line" ]; then
  echo "[verify-ai-budget] FAIL: degradedResponse must short-circuit before the LLM call"; exit 1
fi

echo "[verify-ai-budget] OK (fallback short-circuits LLM at line $budget_line < stream $stream_line)"
