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

// POST /api/users/block  Body: { blocked_id: string }
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { blocked_id } = await req.json();
  if (!blocked_id) return NextResponse.json({ error: "blocked_id is required" }, { status: 400 });
  if (blocked_id === userData.user.id) {
    return NextResponse.json({ error: "You can't block yourself" }, { status: 400 });
  }

  const { error } = await supabase.from("blocked_users").insert({ blocker_id: userData.user.id, blocked_id });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/users/block  Body: { blocked_id: string }  -- unblock
export async function DELETE(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { blocked_id } = await req.json();
  if (!blocked_id) return NextResponse.json({ error: "blocked_id is required" }, { status: 400 });

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", userData.user.id)
    .eq("blocked_id", blocked_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
