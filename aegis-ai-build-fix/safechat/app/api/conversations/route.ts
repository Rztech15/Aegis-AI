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

// GET /api/conversations — list the current user's conversations
export async function GET(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("*, messages(content, sent_at, sender_id)")
    .or(`participant_one.eq.${userData.user.id},participant_two.eq.${userData.user.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hide conversations with anyone the current user has blocked
  const { data: blocks } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userData.user.id);
  const blockedIds = new Set((blocks || []).map((b) => b.blocked_id));
  const visible = (data || []).filter((c) => {
    const other = c.participant_one === userData.user.id ? c.participant_two : c.participant_one;
    return !blockedIds.has(other);
  });

  return NextResponse.json({ conversations: visible });
}

// POST /api/conversations — start a conversation with another user by their profile id
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { other_user_id } = await req.json();
  if (!other_user_id) {
    return NextResponse.json({ error: "other_user_id is required" }, { status: 400 });
  }
  if (other_user_id === userData.user.id) {
    return NextResponse.json({ error: "Can't start a conversation with yourself" }, { status: 400 });
  }

  // Refuse if either side has blocked the other
  const { data: blockCheck } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${userData.user.id},blocked_id.eq.${other_user_id}),and(blocker_id.eq.${other_user_id},blocked_id.eq.${userData.user.id})`
    )
    .maybeSingle();
  if (blockCheck) {
    return NextResponse.json({ error: "You can't start a conversation with this user" }, { status: 403 });
  }

  // Check if a conversation already exists between these two users
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .or(
      `and(participant_one.eq.${userData.user.id},participant_two.eq.${other_user_id}),and(participant_one.eq.${other_user_id},participant_two.eq.${userData.user.id})`
    )
    .maybeSingle();

  if (existing) return NextResponse.json({ conversation: existing });

  const { data, error } = await supabase
    .from("conversations")
    .insert({ participant_one: userData.user.id, participant_two: other_user_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
