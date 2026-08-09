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

// GET /api/trusted-contacts — list trusted contacts with display info
export async function GET(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("trusted_contacts")
    .select("id, contact_id, profiles:contact_id (display_name, username)")
    .eq("user_id", userData.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

// POST /api/trusted-contacts  Body: { username: string }
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: "username is required" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username.replace(/^@/, "")).maybeSingle();
  if (!profile) return NextResponse.json({ error: "No user found with that username" }, { status: 404 });
  if (profile.id === userData.user.id) {
    return NextResponse.json({ error: "You can't add yourself as a trusted contact" }, { status: 400 });
  }

  const { error } = await supabase.from("trusted_contacts").insert({ user_id: userData.user.id, contact_id: profile.id });
  if (error && !error.message.includes("duplicate")) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trusted-contacts  Body: { contact_id: string }
export async function DELETE(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { contact_id } = await req.json();
  if (!contact_id) return NextResponse.json({ error: "contact_id is required" }, { status: 400 });

  const { error } = await supabase.from("trusted_contacts").delete().eq("user_id", userData.user.id).eq("contact_id", contact_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
