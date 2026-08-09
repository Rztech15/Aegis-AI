"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type HubMessage = { role: "user" | "assistant"; content: string };

const PERSONAS = [
  { id: "guardian", name: "Aegis Guardian", icon: "🛡️", desc: "Digital safety & scam questions" },
  { id: "rz", name: "RZ AI", icon: "📊", desc: "Data analysis, Excel & Python" },
  { id: "coding", name: "Coding AI", icon: "💻", desc: "Programming help & debugging" },
  { id: "study", name: "Study AI", icon: "🎓", desc: "Learning & homework help" },
  { id: "writing", name: "Writing AI", icon: "✍️", desc: "Reports, emails & grammar" },
];

export default function HubPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activePersona, setActivePersona] = useState(PERSONAS[0].id);
  const [threads, setThreads] = useState<Record<string, HubMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threads, activePersona]);

  const messages = threads[activePersona] || [];
  const persona = PERSONAS.find((p) => p.id === activePersona)!;

  async function send() {
    if (!draft.trim() || loading) return;
    setError("");
    const userMsg: HubMessage = { role: "user", content: draft };
    const updated = [...messages, userMsg];
    setThreads((prev) => ({ ...prev, [activePersona]: updated }));
    setDraft("");
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/hub/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ persona: activePersona, messages: updated }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error || "Something went wrong");
      return;
    }
    setThreads((prev) => ({ ...prev, [activePersona]: [...updated, { role: "assistant", content: json.reply }] }));
  }

  return (
    <div style={{ height: "100vh", display: "flex", background: "#0A0F0D", fontFamily: "inherit" }}>
      {/* Sidebar */}
      <div style={{ width: 260, borderRight: "1px solid #2E4038", background: "#141B18", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 18, borderBottom: "1px solid #1A251F" }}>
          <button onClick={() => router.push("/chat")} style={{ background: "none", border: "none", color: "#22C55E", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 10 }}>
            ← Back to chat
          </button>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#E6F4EA" }}>Aegis AI Hub</div>
          <div style={{ fontSize: 11, color: "#93A99C", marginTop: 2 }}>Pick an assistant</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePersona(p.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                border: "none",
                borderBottom: "1px solid #182420",
                background: p.id === activePersona ? "#16211C" : "transparent",
                cursor: "pointer",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#E6F4EA" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: "#93A99C" }}>{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid #2E4038", background: "#141B18", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{persona.icon}</span>
          <span>{persona.name}</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: "#93A99C", fontSize: 13, textAlign: "center", marginTop: 40 }}>
              Ask {persona.name} anything — {persona.desc.toLowerCase()}.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "72%" }}>
              <div
                style={{
                  background: m.role === "user" ? "#22C55E" : "#141B18",
                  color: m.role === "user" ? "#141B18" : "#E6F4EA",
                  border: m.role === "user" ? "none" : "1px solid #2E4038",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontSize: 13.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#93A99C", fontSize: 12.5 }}>{persona.name} is typing...</div>}
          {error && <div style={{ color: "#C0392B", fontSize: 12.5 }}>{error}</div>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #2E4038", background: "#141B18", display: "flex", gap: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Message ${persona.name}...`}
            style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid #2E4038", fontSize: 13.5 }}
          />
          <button onClick={send} disabled={loading} style={{ background: "#22C55E", color: "#141B18", border: "none", borderRadius: 10, padding: "0 20px", fontWeight: 700, cursor: "pointer" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
