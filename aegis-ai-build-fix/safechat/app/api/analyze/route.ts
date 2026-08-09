import { NextRequest, NextResponse } from "next/server";
import { detectRisk, ContextMessage } from "@/lib/detectRisk";
import { createSupabaseServiceClient } from "@/lib/supabaseClient";

/**
 * POST /api/analyze
 * Body: { message_id: string, message_text: string, context?: ContextMessage[] }
 *
 * Called right after a message is inserted. Runs async / best-effort — a
 * failure here must never block message delivery, which is why the caller
 * does not await this before returning to the client.
 *
 * PRIVACY NOTE: message content is stored encrypted in the database, so
 * this route can no longer read conversation history from the DB itself
 * (it would only see ciphertext). Instead, the browser — which already
 * decrypts messages locally to display them — sends the plaintext of the
 * current message and recent context directly in this request, for
 * analysis only. Nothing here is persisted in plaintext; only the
 * resulting risk_level and reasons are written back to the database.
 */
export async function POST(req: NextRequest) {
  const { message_id, message_text, context } = await req.json();

  if (!message_id || !message_text) {
    return NextResponse.json({ error: "message_id and message_text are required" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();

    const analysis = await detectRisk(message_text, (context as ContextMessage[]) || []);

    const { data: updated, error } = await supabase
      .from("messages")
      .update({
        risk_level: analysis.risk_level,
        risk_reasons: analysis.reasons,
        risk_explanation: analysis.explanation || null,
        risk_recommendation: analysis.recommendation || null,
      })
      .eq("id", message_id)
      .select("conversation_id")
      .single();

    if (error) throw error;

    // Bump the conversation's denormalized risk_level if this message is riskier
    if (analysis.risk_level !== "low" && updated?.conversation_id) {
      await supabase.from("conversations").update({ risk_level: analysis.risk_level }).eq("id", updated.conversation_id);
    }

    return NextResponse.json({ ok: true, analysis });
  } catch (err: any) {
    console.error("analyze route error:", err);
    // Fail open: the message stays delivered even if analysis fails
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
