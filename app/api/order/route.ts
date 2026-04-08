export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const { sessionId, retailerId, items, customerEmail, customerName, blendName } = await req.json();
    const subtotal = (items || []).reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0);
    const { data: order, error } = await admin.from("orders").insert({ session_id: sessionId, retailer_id: retailerId, customer_email: customerEmail, customer_name: customerName, blend_name: blendName, items, subtotal, status: "pending" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (sessionId) await admin.from("sessions").update({ order_status: "ordered", order_id: order.id, order_total: subtotal, ordered_at: new Date().toISOString() }).eq("id", sessionId);
    await admin.from("events").insert({ retailer_id: retailerId, session_id: sessionId, event_type: "order", payload: { order_id: order.id, blend_name: blendName, subtotal } });
    return NextResponse.json({ success: true, orderId: order.id, subtotal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
