"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
        <button onClick={() => router.back()} style={backBtn}>
          ← Back
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E6F4EA", margin: "0 0 6px" }}>Privacy Policy</h1>
        <p style={{ color: "#A8BDB0", fontSize: 12.5, marginTop: 0 }}>Last updated: {new Date().toLocaleDateString()}</p>

        <div style={disclaimerBox}>
          <strong>Draft notice:</strong> This is a plain-language policy describing what Aegis AI actually collects
          and does, written to be accurate and honest. It has not been reviewed by a lawyer. Before relying on this
          publicly — especially given that Aegis AI may handle sensitive information related to harassment, threats,
          or abuse — have it reviewed by a qualified lawyer familiar with the privacy laws of the countries your
          users are in.
        </div>

        <Section title="What We Collect">
          <ul style={list}>
            <li>Account info: email address, display name, username, profile photo (optional)</li>
            <li>Message content — encrypted in our database; see "How Encryption Works" below</li>
            <li>Message metadata: timestamps, who sent to whom, AI-generated risk labels</li>
            <li>Technical data: IP address (used only for security — see below), device/browser type</li>
            <li>Anything you explicitly submit: reports, evidence exports, trusted contacts</li>
          </ul>
        </Section>

        <Section title="How Encryption Works">
          <p style={p}>
            Messages are encrypted in your browser before they're sent, using keys that never leave your device. Our
            database stores only unreadable ciphertext — we cannot read your messages by looking at the database.
          </p>
          <p style={p}>
            <strong>One important exception:</strong> our AI safety feature needs to check messages for scams,
            threats, and harassment. Since your browser already decrypts messages to show them to you, it also sends
            that decrypted text to our server briefly, for analysis only. We do not store this plaintext — only the
            resulting risk label (e.g. "medium risk") is saved. This is a deliberate tradeoff so the safety feature
            can work; we are telling you about it plainly rather than calling this "fully private" when it isn't.
          </p>
        </Section>

        <Section title="Why We Use Your IP Address">
          <p style={p}>
            We temporarily log IP addresses tied to login attempts, purely to detect and block repeated
            password-guessing attacks (rate limiting). We do not use IP addresses for tracking, advertising, or
            location profiling.
          </p>
        </Section>

        <Section title="Who We Share Data With">
          <ul style={list}>
            <li>
              <strong>Supabase</strong> — our database and authentication provider. They store your account and
              (encrypted) message data.
            </li>
            <li>
              <strong>An AI model provider (via OpenRouter)</strong> — receives message text transiently to run
              safety analysis. Not used for advertising or training their models on your data by our arrangement.
            </li>
            <li>
              <strong>Resend</strong> — sends account emails (sign-up confirmation, password resets).
            </li>
            <li>
              <strong>Vercel</strong> — hosts the application.
            </li>
          </ul>
          <p style={p}>We do not sell your data to anyone, for any reason.</p>
        </Section>

        <Section title="Your Choices">
          <ul style={list}>
            <li>You can edit your display name, username, and photo anytime in Settings</li>
            <li>You can block or report other users</li>
            <li>
              Account deletion isn't self-service yet in the app — contact us (see below) and we'll delete your
              account and associated data manually.
            </li>
          </ul>
        </Section>

        <Section title="Children's Privacy">
          <p style={p}>
            Aegis AI is not currently designed with age verification. If you believe a child has created an account,
            please contact us so we can review and remove it.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p style={p}>We may update this policy as the app changes. We'll update the date at the top when we do.</p>
        </Section>

        <Section title="Contact">
          <p style={p}>For privacy questions, deletion requests, or concerns, contact the Aegis AI team directly.</p>
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
