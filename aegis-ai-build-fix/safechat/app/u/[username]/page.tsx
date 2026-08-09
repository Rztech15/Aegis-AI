"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const username = String(params.username || "");
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(`/chat?start=${encodeURIComponent(username)}`);
      } else {
        setStatus(`Sign in to Aegis AI to start chatting with @${username}`);
        router.replace(`/login?redirect=${encodeURIComponent(`/chat?start=${username}`)}`);
      }
    });
  }, [router, username]);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#A8BDB0", fontSize: 13.5, fontFamily: "inherit" }}>
      {status}
    </div>
  );
}
