"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

const EMERGENCY_NUMBERS = [
  { label: "Rescue (General Emergency)", number: "1122" },
  { label: "Police", number: "15" },
  { label: "Fire Brigade", number: "16" },
  { label: "Edhi Ambulance", number: "115" },
  { label: "FIA Cybercrime Helpline (scams, harassment, fraud)", number: "1991" },
  { label: "Digital Rights Foundation — Cyber Harassment Helpline", number: "0800-39393" },
  { label: "Madadgaar — Gender-Based Violence Helpline", number: "1098" },
  { label: "Child Protection & Welfare Helpline", number: "1121" },
  { label: "Zainab Alert (missing/abducted children)", number: "1099" },
];

export default function SafetyCenterPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px" }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "#22C55E", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 18, padding: 0 }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#141B18", fontWeight: 700 }}>
            🛡
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E6F4EA", margin: 0 }}>Safety Center</h1>
        </div>
        <p style={{ color: "#A8BDB0", fontSize: 13, marginTop: 4, marginBottom: 24 }}>
          If you feel unsafe or need help right now, use the resources below. Aegis AI never contacts authorities on
          your behalf — you're always the one in control.
        </p>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>Emergency Numbers (Pakistan)</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {EMERGENCY_NUMBERS.map((e) => (
              <a key={e.number} href={`tel:${e.number}`} style={numberRowStyle}>
                <span>{e.label}</span>
                <span style={{ fontWeight: 800, color: "#22C55E" }}>{e.number}</span>
              </a>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#93A99C", marginTop: 12 }}>
            The FIA Cybercrime Helpline (1991) operates weekdays, 8am–4pm. Outside Pakistan? Search "[your country]
            emergency number" or contact local police directly.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>Report a Crime or Scam</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <a href="https://cybercrime.gov.pk" target="_blank" rel="noreferrer" style={linkRowStyle}>
              National Cyber Crime Reporting Portal →
            </a>
            <a href="https://www.fia.gov.pk/ccw" target="_blank" rel="noreferrer" style={linkRowStyle}>
              FIA Cyber Crime Wing →
            </a>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>If a Conversation Feels Dangerous</h2>
          <ol style={{ fontSize: 13, color: "#E6F4EA", lineHeight: 1.9, paddingLeft: 18, margin: "12px 0 0" }}>
            <li>Open the conversation and use <strong>Select messages for evidence</strong> to save proof.</li>
            <li>Use <strong>Block user</strong> to stop further contact.</li>
            <li>Use <strong>Report conversation</strong> so it's on record.</li>
            <li>If you're in immediate physical danger, call emergency services above right now — don't wait.</li>
          </ol>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>A Note on AI Safety Warnings</h2>
          <p style={{ fontSize: 13, color: "#E6F4EA", lineHeight: 1.7, margin: "12px 0 0" }}>
            Aegis AI's risk warnings are an assessment, not a final judgment. They're meant to help you notice
            patterns — the decision about what to do next is always yours.
          </p>
        </section>

        <div style={{ textAlign: "center", fontSize: 11.5, color: "#93A99C", marginTop: 8 }}>
          <a href="/privacy" style={{ color: "#22C55E" }}>
            Privacy Policy
          </a>{" "}
          ·{" "}
          <a href="/terms" style={{ color: "#22C55E" }}>
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#141B18",
  border: "1px solid #2E4038",
  borderRadius: 12,
  padding: "18px 20px",
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "#E6F4EA", margin: 0 };

const numberRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  background: "#0A0F0D",
  borderRadius: 8,
  fontSize: 13,
  color: "#E6F4EA",
  textDecoration: "none",
};

const linkRowStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  background: "#0A0F0D",
  borderRadius: 8,
  fontSize: 13,
  color: "#22C55E",
  fontWeight: 600,
  textDecoration: "none",
};
