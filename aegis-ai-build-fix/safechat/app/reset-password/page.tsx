"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Clicking the reset-password email link gives this page a temporary
    // "recovery" session automatically (Supabase handles the token exchange
    // from the URL). We just need to confirm a session exists.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("This reset link is invalid or has expired. Request a new one from the login page.");
      }
      setReady(true);
    });
  }, [supabase]);

  async function updatePassword() {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/chat"), 1500);
  }

  if (!ready) return null;

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ width: 380, background: "#141B18", border: "1px solid #2E4038", borderRadius: 14, padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#141B18", fontWeight: 700 }}>
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#E6F4EA" }}>Reset your password</span>
        </div>

        {done ? (
          <div style={{ fontSize: 13.5, color: "#22C55E", marginTop: 16 }}>Password updated. Taking you to Aegis AI...</div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "#93A99C", margin: "16px 0" }}>Choose a new password for your account.</div>
            <label style={labelStyle}>New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={inputStyle} />
            <label style={{ ...labelStyle, marginTop: 14 }}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && updatePassword()}
            />
            <button onClick={updatePassword} disabled={saving} style={buttonStyle}>
              {saving ? "Updating..." : "Update password"}
            </button>
          </>
        )}

        {error && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, color: "#A8BDB0", fontWeight: 600, display: "block" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2E4038",
  fontSize: 13.5,
  marginTop: 6,
  marginBottom: 4,
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#0F1613",
  color: "#E6F4EA",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: "11px 0",
  borderRadius: 8,
  border: "none",
  background: "#22C55E",
  color: "#141B18",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
