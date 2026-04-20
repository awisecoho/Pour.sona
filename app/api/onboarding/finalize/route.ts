import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { draftId, ownerEmail } = await req.json()
    if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })
    const retailer = await publishDraft(draftId, ownerEmail)
    // Return wrapped in { retailer } so the onboard page success screen works
    return NextResponse.json({
      retailer,
      links: {
        storefront: `https://pour-sona.vercel.app/r/${retailer.slug}`,
        admin: `https://pour-sona.vercel.app/admin`,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
