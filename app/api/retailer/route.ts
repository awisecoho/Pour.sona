export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  try {
    const retailerResult = await dbQuery(
      'select * from retailers where slug = $1 and active = true limit 1',
      [slug]
    );

    const retailer = retailerResult.rows[0];
    if (!retailer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [flightsResult, sessionResult] = await Promise.all([
      dbQuery(
        'select * from flights where retailer_id = $1 and active = true order by sort_order nulls last',
        [retailer.id]
      ),
      dbQuery(
        'insert into sessions (retailer_id, messages) values ($1, $2::jsonb) returning id',
        [retailer.id, JSON.stringify([])]
      ),
    ]);

    const sessionId = sessionResult.rows[0]?.id ?? null;

    if (!sessionId) {
      console.error('[api/retailer] session insert returned no id — aborting')
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    if (sessionId) {
      try {
        await dbQuery(
          'insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, $3, $4::jsonb)',
          [retailer.id, sessionId, 'scan', JSON.stringify({ slug })]
        );
      } catch (error) {
        console.error(
          "[api/retailer] failed to log scan event:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return NextResponse.json({
      retailer,
      flights: flightsResult.rows,
      sessionId,
    });
  } catch (err) {
    return apiError(err, 'Retailer lookup failed')
  }
}
