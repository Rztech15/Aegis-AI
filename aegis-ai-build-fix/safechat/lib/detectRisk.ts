/**
 * AI Safety Engine — LLM-based detection via OpenRouter.
 *
 * This is the MVP approach: prompt a capable model to classify the message
 * instead of training a custom classifier. Ships fast, no labeled dataset
 * required to launch. The dataset labeling template + ML plan (see /docs)
 * describe the path to a custom-trained model later, once cost/latency/
 * accuracy at scale makes that worthwhile.
 */

export type RiskLevel = "low" | "medium" | "high";

export type RiskReason = { pattern: string; label: string };

export type RiskAnalysis = {
  risk_level: RiskLevel;
  risk_score: number; // 0-10
  reasons: RiskReason[];
  explanation: string; // one sentence: why this specific message is risky
  recommendation: string; // one sentence: what the user should actually do
};

export type ContextMessage = { sender: "them" | "me"; content: string };

const LABELS = [
  "scam_fraud",
  "phishing",
  "job_investment_scam",
  "impersonation",
  "harassment",
  "threat_blackmail",
  "romance_scam",
  "spam",
] as const;

const SYSTEM_PROMPT = `You are a message safety classifier for a messaging app. You analyze the MOST RECENT message for signs of: scam/fraud, phishing, job or investment scams, impersonation, harassment, threats/blackmail, romance scams, or spam.

You are given the last few messages in the conversation as CONTEXT, then the new message to classify. Use the context to judge intent correctly:
- The same words can be a harmless joke between people with a warm, casual rapport, or a real threat depending on what came before.
- Look for genuine warning signs: escalating anger, one-sided pressure, a stranger who suddenly asks for money/personal info, repeated unwanted contact despite the other person disengaging, or a consistent pattern building toward manipulation.
- Casual, affectionate, sarcastic, or joking tone between people who seem to know each other is LOW risk even if individual words sound alarming in isolation.
- A pattern that escalates over several messages (e.g. friendly small talk -> urgency -> money request) should be flagged even if the final message alone looks mild — judge the trend, not just the last line.

For medium/high risk, don't just label the pattern — explain it and tell the user what to actually do, so the warning is useful in the moment, not just a score:
- "explanation" should read like you're telling a friend what's going on: name the SPECIFIC tactic used in THIS message (e.g. "The sender is asking you to move this conversation to another app and send money urgently" — not a generic category name).
- "recommendation" should be a concrete next step for THIS situation (e.g. "Don't send money or personal details. Verify who this is through a separate, trusted channel before responding."), not generic advice like "be careful."
- For low risk, leave both "explanation" and "recommendation" as empty strings — don't manufacture concern where there isn't any.

Rules:
- You NEVER accuse a person of being a criminal or scammer. You only describe patterns found in the TEXT.
- Be conservative: only flag medium/high risk when there are clear, specific signals. Ordinary conversation, even if blunt, emotional, or dark-humored, is low risk.
- Respond with ONLY valid JSON, no other text, in exactly this shape:
{
  "risk_level": "low" | "medium" | "high",
  "risk_score": <integer 0-10>,
  "reasons": [ { "pattern": "<one of: ${LABELS.join(", ")}>", "label": "<short plain-language reason, under 12 words>" } ],
  "explanation": "<one sentence, specific to this message, or empty string if low risk>",
  "recommendation": "<one sentence, concrete next step, or empty string if low risk>"
}
If no risk is found, return risk_level "low", risk_score 0, reasons: [], explanation: "", recommendation: "".`;

export async function detectRisk(messageText: string, context: ContextMessage[] = []): Promise<RiskAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const contextBlock =
    context.length > 0
      ? `CONTEXT (most recent ${context.length} messages before this one, oldest first):\n` +
        context.map((m) => `${m.sender === "me" ? "This user" : "Other person"}: ${m.content}`).join("\n") +
        `\n\nNEW MESSAGE TO CLASSIFY:\n${messageText}`
      : messageText;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextBlock },
      ],
      temperature: 0,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  return parseAnalysis(raw);
}

function parseAnalysis(raw: string): RiskAnalysis {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const risk_level: RiskLevel = ["low", "medium", "high"].includes(parsed.risk_level)
      ? parsed.risk_level
      : "low";

    const risk_score = typeof parsed.risk_score === "number" ? parsed.risk_score : 0;

    const reasons: RiskReason[] = Array.isArray(parsed.reasons)
      ? parsed.reasons
          .filter((r: any) => r && typeof r.label === "string")
          .map((r: any) => ({ pattern: String(r.pattern || "unknown"), label: String(r.label) }))
      : [];

    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : "";
    const recommendation = typeof parsed.recommendation === "string" ? parsed.recommendation : "";

    return { risk_level, risk_score, reasons, explanation, recommendation };
  } catch (err) {
    // Fail safe: if the model output isn't parseable JSON, treat as
    // low risk rather than blocking the message pipeline. Log for review.
    console.error("detectRisk: failed to parse model output", raw, err);
    return { risk_level: "low", risk_score: 0, reasons: [], explanation: "", recommendation: "" };
  }
}
