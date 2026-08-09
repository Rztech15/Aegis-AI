import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PERSONAS } from "@/lib/personas";

function supabaseForRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

/**
 * POST /api/hub/chat
 * Body: { persona: string, messages: { role: "user" | "assistant", content: string }[] }
 *
 * This is a user <-> AI assistant conversation (not user <-> user messaging),
 * so it does not go through the risk-detection pipeline used for chats
 * between people. Conversation history is kept in the browser only for
 * now — not persisted server-side.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseForRequest(req);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { persona, messages } = await req.json();
  const config = PERSONAS[persona];
  if (!config) return NextResponse.json({ error: "Unknown assistant" }, { status: 400 });
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI Hub is not configured" }, { status: 500 });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: config.systemPrompt }, ...messages.slice(-20)],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("hub chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
