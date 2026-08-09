import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseForRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// POST /api/evidence  Body: { conversation_id, message_ids: string[] }
// Saves a snapshot of selected messages as an evidence report. Opt-in only —
// never triggered automatically by the AI, only by explicit user action.
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { conversation_id, message_ids } = await req.json();
  if (!conversation_id || !Array.isArray(message_ids) || message_ids.length === 0) {
    return NextResponse.json({ error: "conversation_id and message_ids are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("evidence_reports")
    .insert({ user_id: userData.user.id, conversation_id, message_ids, status: "saved" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}

// GET /api/evidence?conversation_id=...  -- list this user's saved reports (optionally filtered)
export async function GET(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const conversationId = req.nextUrl.searchParams.get("conversation_id");
  let query = supabase.from("evidence_reports").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false });
  if (conversationId) query = query.eq("conversation_id", conversationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data });
}
