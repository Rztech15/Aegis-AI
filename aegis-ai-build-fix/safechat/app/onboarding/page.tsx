"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      // If this user already has a username, there's nothing to do here
      const { data: profile } = await supabase.from("profiles").select("username, display_name").eq("id", data.session.user.id).single();
      if (profile?.username) {
        router.replace("/chat");
        return;
      }
      setUserId(data.session.user.id);
      setDisplayName(profile?.display_name || data.session.user.email?.split("@")[0] || "");
      setCheckingSession(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!username.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
      const json = await res.json();
      if (json.available) {
        setStatus("available");
        setStatusMsg("Available");
      } else {
        setStatus(json.reason ? "invalid" : "taken");
        setStatusMsg(json.reason || "Already taken");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  async function finish() {
    setError("");
    if (status !== "available") {
      setError("Please choose an available username first.");
      return;
    }
    if (!userId) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase(), display_name: displayName || username })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace("/chat");
  }

  if (checkingSession) return null;

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ width: 380, background: "#141B18", border: "1px solid #2E4038", borderRadius: 14, padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#141B18", fontWeight: 700 }}>
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#E6F4EA" }}>Welcome to Aegis AI</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#93A99C", marginBottom: 20 }}>
          One last step — pick a username so people can find and message you.
        </div>

        <label style={labelStyle}>Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 14 }}>Username</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 16, fontSize: 13.5, color: "#93A99C" }}>@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="username"
            style={{ ...inputStyle, paddingLeft: 22 }}
            onKeyDown={(e) => e.key === "Enter" && finish()}
          />
        </div>
        {status !== "idle" && (
          <div style={{ fontSize: 11, color: status === "available" ? "#3E9B5C" : "#C0392B", marginTop: -2, marginBottom: 4 }}>
            {status === "checking" ? "Checking..." : statusMsg}
          </div>
        )}

        <button onClick={finish} disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Continue to Aegis AI"}
        </button>

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
