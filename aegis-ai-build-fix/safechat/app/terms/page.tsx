"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
        <button onClick={() => router.back()} style={backBtn}>
          ← Back
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E6F4EA", margin: "0 0 6px" }}>Terms of Service</h1>
        <p style={{ color: "#A8BDB0", fontSize: 12.5, marginTop: 0 }}>Last updated: {new Date().toLocaleDateString()}</p>

        <div style={disclaimerBox}>
          <strong>Draft notice:</strong> This is a plain-language draft written to accurately describe how Aegis AI
          works today. It has not been reviewed by a lawyer. Have it reviewed before relying on it publicly,
          especially regarding liability limits and dispute resolution, which vary significantly by country.
        </div>

        <Section title="1. Acceptance">
          <p style={p}>By creating an account, you agree to these terms. If you don't agree, please don't use Aegis AI.</p>
        </Section>

        <Section title="2. What Aegis AI Is">
          <p style={p}>
            Aegis AI is a messaging platform with an AI-powered safety layer that analyzes messages for signs of
            scams, phishing, harassment, and threats, and shows risk warnings. These warnings are automated
            assessments, not professional advice, and not a guarantee of safety.
          </p>
        </Section>

        <Section title="3. Not a Substitute for Emergency Services">
          <p style={p}>
            Aegis AI never contacts police, emergency services, or any authority on your behalf. If you are in
            immediate danger, contact local emergency services directly — do not rely on this app to do it for you.
            See our Safety Center for emergency numbers.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p style={p}>You agree not to use Aegis AI to:</p>
          <ul style={list}>
            <li>Harass, threaten, blackmail, or scam other users</li>
            <li>Impersonate another person or organization</li>
            <li>Share illegal content, or content exploiting or endangering minors</li>
            <li>Attempt to bypass, disable, or abuse the safety detection or reporting systems</li>
            <li>Spam or mass-report other users in bad faith</li>
          </ul>
          <p style={p}>Violating these terms may result in your account being suspended or removed.</p>
        </Section>

        <Section title="5. Your Content">
          <p style={p}>
            You retain ownership of the messages and content you send. You're responsible for what you send and
            share. Message content is encrypted (see our Privacy Policy for exactly how and its limitations).
          </p>
        </Section>

        <Section title="6. AI Limitations">
          <p style={p}>
            Our AI safety detection is not perfect. It can miss genuine risks (false negatives) and can flag
            harmless messages incorrectly (false positives). Risk warnings are a signal to help you make your own
            decision — they are never a final judgment about another person, and you should use your own judgment
            alongside them.
          </p>
        </Section>

        <Section title="7. Account Termination">
          <p style={p}>
            We may suspend or terminate accounts that violate these terms, including in response to user reports.
            You may stop using the service at any time; contact us to request full account deletion.
          </p>
        </Section>

        <Section title="8. No Warranty">
          <p style={p}>
            Aegis AI is provided "as is." We do not guarantee the service will be uninterrupted, error-free, or that
            it will catch every scam, threat, or harmful message.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p style={p}>
            To the fullest extent permitted by law, Aegis AI and its creators are not liable for damages arising
            from your use of the service, including harm resulting from messages, content, or interactions with
            other users, or from reliance on AI-generated risk assessments.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p style={p}>We may update these terms as the app changes. Continued use after changes means you accept the updated terms.</p>
        </Section>

        <Section title="11. Contact">
          <p style={p}>Questions about these terms? Contact the Aegis AI team directly.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#E6F4EA", margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

const backBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#22C55E",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 18,
  padding: 0,
};

const disclaimerBox: React.CSSProperties = {
  background: "#FBF3DE",
  border: "1px solid #E8D9A8",
  borderRadius: 10,
  padding: "14px 16px",
  fontSize: 12.5,
  color: "#6B5410",
  lineHeight: 1.6,
  margin: "16px 0",
};

const p: React.CSSProperties = { fontSize: 13, color: "#E6F4EA", lineHeight: 1.7, margin: "0 0 8px" };

const list: React.CSSProperties = { fontSize: 13, color: "#E6F4EA", lineHeight: 1.9, paddingLeft: 18, margin: 0 };
