"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/chat");
      } else {
        router.replace("/login");
      }
      setChecking(false);
    });
  }, [router]);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#A8BDB0" }}>
      {checking ? "Loading Aegis AI..." : null}
    </div>
  );
}
