import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export function apiError(err: unknown, fallback: string, status = 500) {
  console.error(`[api] ${fallback}`, err)
  Sentry.captureException(err)
  return NextResponse.json({ error: fallback }, { status })
}
