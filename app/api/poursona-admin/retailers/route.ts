import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const retailersResult = await dbQuery(
      'select * from retailers order by created_at desc',
      []
    )
    const retailers = retailersResult.rows

    const result = await Promise.all(retailers.map(async (r: any) => {
      const [totalResult, orderedResult] = await Promise.all([
        dbQuery('select count(*) from sessions where retailer_id = $1', [r.id]),
        dbQuery("select count(*) from sessions where retailer_id = $1 and order_status = 'ordered'", [r.id]),
      ])
      return {
        ...r,
        stats: {
          total: parseInt(totalResult.rows[0]?.count || '0', 10),
          recommended: 0,
          ordered: parseInt(orderedResult.rows[0]?.count || '0', 10),
        },
      }
    }))

    return NextResponse.json({ retailers: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
