/**
 * Back-compat shim. The original buildSystemPrompt lived here as a single
 * function with hardcoded per-vertical voices. Phase 1 moved the real work into
 * lib/agent/build-prompt.ts so behaviour is driven by AssistantProfile +
 * category template. This file just delegates so existing callers (currently
 * app/api/chat/route.ts) keep compiling.
 *
 * New code should import directly from '@/lib/agent/build-prompt'.
 */
export { buildAssistantPrompt as buildSystemPrompt } from '@/lib/agent/build-prompt'
