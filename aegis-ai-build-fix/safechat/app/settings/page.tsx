"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUserId(data.session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", data.session.user.id)
        .single();
      if (profile) {
        setDisplayName(profile.display_name || "");
        setUsername(profile.username || "");
        setOriginalUsername(profile.username || "");
        setAvatarUrl(profile.avatar_url);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!username.trim() || username === originalUsername) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
      const json = await res.json();
      if (json.available) {
        setUsernameStatus("available");
        setUsernameMsg("Available");
      } else {
        setUsernameStatus(json.reason ? "invalid" : "taken");
        setUsernameMsg(json.reason || "Already taken");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, originalUsername]);

  async function uploadAvatar(file: File) {
    if (!userId) return;
    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError("Upload failed: " + uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);
    setUploading(false);
    if (updateError) {
      setError("Could not save photo: " + updateError.message);
      return;
    }
    setAvatarUrl(urlData.publicUrl);
  }

  async function saveProfile() {
    if (!userId) return;
    setError("");
    setMessage("");
    if (username !== originalUsername && usernameStatus !== "available") {
      setError("Please choose an available username first.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName, username: username.toLowerCase() })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setOriginalUsername(username.toLowerCase());
    setMessage("Profile updated.");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0F0D", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 20px" }}>
        <button onClick={() => router.push("/chat")} style={{ background: "none", border: "none", color: "#22C55E", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 18, padding: 0 }}>
          ← Back to chat
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E6F4EA", margin: "0 0 20px" }}>Settings</h1>

        <div style={{ background: "#141B18", border: "1px solid #2E4038", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#141B18",
                fontSize: 28,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              {!avatarUrl && (displayName.charAt(0).toUpperCase() || "A")}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
                e.target.value = "";
              }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: 12, color: "#22C55E", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
              {uploading ? "Uploading..." : "Change photo"}
            </button>
          </div>

          <label style={labelStyle}>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Username</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 16, fontSize: 13.5, color: "#93A99C" }}>@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              style={{ ...inputStyle, paddingLeft: 22 }}
            />
          </div>
          {usernameStatus !== "idle" && (
            <div style={{ fontSize: 11, color: usernameStatus === "available" ? "#3E9B5C" : "#C0392B", marginTop: -2, marginBottom: 4 }}>
              {usernameStatus === "checking" ? "Checking..." : usernameMsg}
            </div>
          )}

          <button onClick={saveProfile} disabled={saving} style={buttonStyle}>
            {saving ? "Saving..." : "Save changes"}
          </button>

          {error && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
          {message && <div style={{ color: "#22C55E", fontSize: 12.5, marginTop: 12 }}>{message}</div>}
        </div>
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
