import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_REPORTS_PER_DAY = 5;

function supabaseForRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// POST /api/users/report  Body: { reported_id, conversation_id?, reason?, evidence_message_ids? }
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reported_id, conversation_id, reason, evidence_message_ids } = await req.json();
  if (!reported_id) return NextResponse.json({ error: "reported_id is required" }, { status: 400 });

  if (reported_id === userData.user.id) {
    return NextResponse.json({ error: "You can't report yourself" }, { status: 400 });
  }

  // If a conversation is attached, make sure the reporter is actually part
  // of it and the reported person is the other participant — stops someone
  // reporting a stranger they have no real interaction with.
  if (conversation_id) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("participant_one, participant_two")
      .eq("id", conversation_id)
      .maybeSingle();
    const valid =
      conv &&
      (conv.participant_one === userData.user.id || conv.participant_two === userData.user.id) &&
      (conv.participant_one === reported_id || conv.participant_two === reported_id);
    if (!valid) {
      return NextResponse.json({ error: "You can only report a conversation you're part of" }, { status: 403 });
    }
  }

  // Rate limit: cap how many reports one person can file per day, so the
  // report system can't itself be used as a harassment/spam tool.
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", userData.user.id)
    .gte("created_at", windowStart);

  if ((count || 0) >= MAX_REPORTS_PER_DAY) {
    return NextResponse.json(
      { error: `You've reached the limit of ${MAX_REPORTS_PER_DAY} reports per day. Please try again tomorrow.` },
      { status: 429 }
    );
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: userData.user.id,
    reported_id,
    conversation_id: conversation_id || null,
    reason: (reason || "").slice(0, 1000) || null,
    evidence_message_ids: evidence_message_ids || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
