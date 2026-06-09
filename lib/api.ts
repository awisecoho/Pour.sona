import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export function apiError(err: unknown, fallback: string, status = 500) {
  console.error(`[api] ${fallback}`, err)
  Sentry.captureException(err)
  return NextResponse.json({ error: fallback }, { status })
}

/**
 * Error responder for admin routes. Logs the underlying error server-side with
 * the Postgres message + code surfaced explicitly — so schema drift (e.g. a
 * missing column like host_persona → "column ... does not exist" [42703]) is
 * obvious in the logs — and reports it to Sentry. Returns the admin routes'
 * standard { ok: false, error } shape with a generic client message; the real
 * error is never sent to the browser.
 */
export function adminError(scope: string, err: unknown, clientError: string, status = 500) {
  const e = err as { message?: unknown; code?: unknown; detail?: unknown }
  const detail = [
    typeof e?.message === 'string' ? e.message : undefined,
    typeof e?.code === 'string' ? `[${e.code}]` : undefined,
    typeof e?.detail === 'string' ? e.detail : undefined,
  ].filter(Boolean).join(' ')
  console.error(`[api/admin/${scope}] ${clientError}: ${detail || String(err)}`)
  Sentry.captureException(err)
  return NextResponse.json({ ok: false, error: clientError }, { status })
}
