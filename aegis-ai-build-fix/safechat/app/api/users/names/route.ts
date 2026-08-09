import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

/**
 * POST /api/users/names
 * Body: { ids: string[] }
 *
 * Profiles have RLS restricting reads to your own row, so the client can't
 * look up other participants' display names directly. This route exposes
 * only { id, display_name, public_key } for the requested ids — the public
 * key is safe to share (that's the point of asymmetric crypto) and is
 * needed client-side to derive per-conversation encryption keys.
 */
export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ names: {}, publicKeys: {} });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("profiles").select("id, display_name, public_key").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const names: Record<string, string> = {};
  const publicKeys: Record<string, string> = {};
  for (const row of data) {
    names[row.id] = row.display_name || `User ${row.id.slice(0, 8)}`;
    if (row.public_key) publicKeys[row.id] = row.public_key;
  }
  return NextResponse.json({ names, publicKeys });
}
