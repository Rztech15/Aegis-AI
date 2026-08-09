import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

/**
 * POST /api/users/lookup
 * Body: { username: string }
 *
 * Looks up a user's id + display name by @username so people can start a
 * chat without ever handling a raw UUID or knowing someone's email.
 */
export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const cleaned = username.replace(/^@/, "").trim();
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, public_key")
    .ilike("username", cleaned)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: `No Aegis AI user found with username @${cleaned}` }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    display_name: data.display_name || `@${data.username}`,
    public_key: data.public_key || null,
  });
}
