"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/chat";
  const supabase = createSupabaseBrowserClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live-check username availability as the user types (debounced)
  useEffect(() => {
    if (mode !== "signup") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!username.trim()) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
        const json = await res.json();
        if (json.available) {
          setUsernameStatus("available");
          setUsernameMsg("Available");
        } else if (json.reason) {
          setUsernameStatus("invalid");
          setUsernameMsg(json.reason);
        } else {
          setUsernameStatus("taken");
          setUsernameMsg("That username is already taken");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, mode]);

  async function handleSignUp() {
    setError("");
    setInfo("");
    if (!email.trim() || !password.trim() || !username.trim()) {
      setError("Email, username, and password are all required.");
      return;
    }
    if (usernameStatus !== "available") {
      setError("Please choose an available username first.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName || email.split("@")[0],
          username: username.toLowerCase().trim(),
        },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace(redirectTo);
    } else {
      setInfo("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
    }
  }

  async function handleForgotPassword() {
    setError("");
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForgotSent(true);
  }

  async function handleSignIn() {
    setError("");
    setInfo("");
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);

    // Routed through our own API so failed attempts are rate-limited
    // server-side, rather than calling Supabase directly from the browser.
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const json = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(json.error || "Sign in failed");
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });
    setLoading(false);
    if (sessionError) {
      setError(sessionError.message);
      return;
    }
    router.replace(redirectTo);
  }

  function submit() {
    if (mode === "signup") handleSignUp();
    else handleSignIn();
  }

  const usernameColor =
    usernameStatus === "available" ? "#3E9B5C" : usernameStatus === "checking" ? "#93A99C" : "#C0392B";

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0F0D" }}>
      <div style={{ width: 380, background: "#141B18", border: "1px solid #2E4038", borderRadius: 14, padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", color: "#141B18", fontWeight: 700 }}>
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#E6F4EA" }}>Aegis AI</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#93A99C", marginBottom: 20 }}>Safe Communication. Smart Protection.</div>

        {forgotMode ? (
          <>
            {forgotSent ? (
              <div style={{ fontSize: 13, color: "#22C55E" }}>
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: "#E6F4EA", marginBottom: 12 }}>Enter your email and we'll send a reset link.</div>
                <label style={labelStyle}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                  onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                />
                <button onClick={handleForgotPassword} disabled={loading} style={buttonStyle}>
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </>
            )}
            <button
              onClick={() => {
                setForgotMode(false);
                setForgotSent(false);
                setError("");
              }}
              style={{ ...buttonStyle, marginTop: 10, background: "#1A251F", color: "#C7D9CD", border: "1px solid #3A5245" }}
            >
              Back to sign in
            </button>
            {error && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
          </>
        ) : (
          <>div style={{ display: "flex", marginBottom: 18, borderRadius: 8, background: "#182420", padding: 3 }}>
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setInfo("");
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 700,
                background: mode === m ? "#141B18" : "transparent",
                color: mode === m ? "#E6F4EA" : "#93A99C",
                boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <>
            <label style={labelStyle}>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What should we call you?" style={inputStyle} />

            <label style={{ ...labelStyle, marginTop: 14 }}>Username</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: 16, fontSize: 13.5, color: "#93A99C" }}>@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                style={{ ...inputStyle, paddingLeft: 22 }}
              />
            </div>
            {usernameStatus !== "idle" && (
              <div style={{ fontSize: 11, color: usernameColor, marginTop: -2, marginBottom: 4 }}>
                {usernameStatus === "checking" ? "Checking..." : usernameMsg}
              </div>
            )}
          </>
        )}

        <label style={{ ...labelStyle, marginTop: mode === "signup" ? 14 : 0 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
          style={inputStyle}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {mode === "signin" && (
          <button
            onClick={() => {
              setForgotMode(true);
              setError("");
            }}
            style={{ background: "none", border: "none", color: "#22C55E", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 4 }}
          >
            Forgot password?
          </button>
        )}

        <button onClick={submit} disabled={loading} style={buttonStyle}>
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#2E4038" }} />
          <span style={{ fontSize: 11, color: "#93A99C" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#2E4038" }} />
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: `${window.location.origin}${redirectTo}` },
            });
          }}
          style={{ ...buttonStyle, marginTop: 0, background: "#1A251F", color: "#E6F4EA", border: "1px solid #3A5245" }}
        >
          Continue with Google
        </button>

        {error && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 12 }}>{error}</div>}
        {info && <div style={{ color: "#22C55E", fontSize: 12.5, marginTop: 12 }}>{info}</div>}

        {mode === "signup" && (
          <div style={{ fontSize: 10.5, color: "#93A99C", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
            By creating an account, you agree to our{" "}
            <a href="/terms" target="_blank" style={{ color: "#22C55E" }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" style={{ color: "#22C55E" }}>
              Privacy Policy
            </a>
            .
          </div>
        )}
          </>
        )}
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
