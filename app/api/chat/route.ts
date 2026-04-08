export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/prompts";

function getClients() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return { supabase, supabaseAdmin, anthropic };
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, supabaseAdmin, anthropic } = getClients();
    const { sessionId, retailerSlug, messages } = await req.json();
    const { data: retailer } = await supabase.from("retailers").select("*").eq("slug", retailerSlug).eq("active", true).single();
    if (!retailer) return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    const { data: products } = await supabase.from("products").select("*").eq("retailer_id", retailer.id).eq("in_stock", true).order("sort_order");
    const { data: flights } = await supabaseAdmin.from("flights").select("*").eq("retailer_id", retailer.id).eq("active", true).order("sort_order");
    const system = buildSystemPrompt(retailer, products || []);
    const response = await anthropic.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1024, system, messages: messages.map((m: any) => ({ role: m.role, content: m.content })) });
    const text = response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const recMatch = text.match(/===REC===([\s\S]*?)===END===/);
    let recData = null;
    if (recMatch) { try { recData = JSON.parse(recMatch[1].trim()); } catch {} }
    if (sessionId) {
      await supabase.from("sessions").update({ messages: [...messages, { role: "assistant", content: text }], ...(recData && { blend_name: recData.title, blend_data: recData, order_status: "recommended" }) }).eq("id", sessionId);
      await supabase.from("events").insert({ retailer_id: retailer.id, session_id: sessionId, event_type: recData ? "recommendation" : "message", payload: {} });
    }
    return NextResponse.json({ text, recData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
