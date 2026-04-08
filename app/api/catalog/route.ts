export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const admin = getAdmin();
  const retailerId = req.nextUrl.searchParams.get("retailerId");
  if (!retailerId) return NextResponse.json({ error: "Missing retailerId" }, { status: 400 });
  const { data, error } = await admin.from("products").select("*").eq("retailer_id", retailerId).order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const admin = getAdmin();
  const { retailerId, ...product } = await req.json();
  const { data, error } = await admin.from("products").insert({ retailer_id: retailerId, ...product }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const admin = getAdmin();
  const { id, ...updates } = await req.json();
  const { data, error } = await admin.from("products").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const admin = getAdmin();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
