import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin', req.url))
}
