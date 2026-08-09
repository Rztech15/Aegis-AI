import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Routes sign-in through the server so failed attempts can be rate-limited
 * before they ever reach Supabase auth. Limits by BOTH email and IP so an
 * attacker can't dodge the limit by rotating one or the other.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const service = createSupabaseServiceClient();
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  // Check recent failed attempts for this email OR this IP
  const { data: recentFailures } = await service
    .from("login_attempts")
    .select("id")
    .eq("success", false)
    .gte("created_at", windowStart)
    .or(`email.eq.${email.toLowerCase()},ip.eq.${ip}`);

  if ((recentFailures?.length || 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Too many failed attempts. Please try again in ${WINDOW_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  // Attempt the actual sign-in against Supabase auth
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  // Record this attempt (success or failure) for future rate-limit checks
  await service.from("login_attempts").insert({ email: email.toLowerCase(), ip, success: !error });

  if (error) {
    // Generic message on purpose — don't reveal whether the email exists
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
  });
}
