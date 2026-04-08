export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

export async function GET(req) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const { data: retailer, error } = await supabase.from("retailers").select("*").eq("slug", slug).eq("active", true).single();
  if (error || !retailer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: flights } = await supabaseAdmin.from("flights").select("*").eq("retailer_id", retailer.id).eq("active", true).order("sort_order");
  const { data: session } = await supabaseAdmin.from("sessions").insert({ retailer_id: retailer.id, messages: [] }).select("id").single();
  return NextResponse.json({ retailer, flights: flights || [], sessionId: session?.id || null });
}
