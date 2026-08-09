import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// GET /api/users/check-username?username=someone
export async function GET(req: NextRequest) {
  const username = (req.nextUrl.searchParams.get("username") || "").toLowerCase().trim();

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({
      available: false,
      reason: "Usernames must be 3-20 characters: lowercase letters, numbers, and underscores only.",
    });
  }

  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();

  return NextResponse.json({ available: !data });
}
