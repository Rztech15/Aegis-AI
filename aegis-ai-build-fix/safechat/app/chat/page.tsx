"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ensureKeyPair, deriveSharedKey, encryptText, decryptText, encryptFile, decryptFileToObjectUrl } from "@/lib/crypto";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_mime?: string | null;
  encrypted?: boolean;
  iv?: string | null;
  sent_at: string;
  risk_level: "low" | "medium" | "high" | null;
  risk_reasons: { pattern: string; label: string }[] | null;
  risk_explanation?: string | null;
  risk_recommendation?: string | null;
};

type Conversation = {
  id: string;
  participant_one: string;
  participant_two: string;
  risk_level: "low" | "medium" | "high";
};

const RISK_META = {
  low: { color: "#3E9B5C", bg: "#EAF6ED", label: "Low risk" },
  medium: { color: "#B8860B", bg: "#FBF3DE", label: "Medium risk" },
  high: { color: "#C0392B", bg: "#FBE8E0", label: "High risk" },
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 16px",
  border: "none",
  background: "none",
  fontSize: 12.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
  color: "#E6F4EA",
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newContactUsername, setNewContactUsername] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [publicKeys, setPublicKeys] = useState<Record<string, string>>({});
  const myPrivateKeyRef = useRef<CryptoKey | null>(null);
  const sharedKeyCacheRef = useRef<Record<string, CryptoKey>>({});
  const publicKeysRef = useRef<Record<string, string>>({});
  const conversationsRef = useRef<Conversation[]>([]);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [decryptedImageUrls, setDecryptedImageUrls] = useState<Record<string, string>>({});
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [trustedPanelOpen, setTrustedPanelOpen] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState<{ id: string; contact_id: string; profiles: { display_name: string; username: string } }[]>([]);
  const [newTrustedUsername, setNewTrustedUsername] = useState("");
  const [trustedError, setTrustedError] = useState("");
  const startHandledRef = useRef(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("aegis-dark-mode") : null;
    if (saved === "true") setDarkMode(true);
  }, []);

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") localStorage.setItem("aegis-dark-mode", String(next));
      return next;
    });
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Gets (deriving + caching if needed) the shared AES key for a conversation partner. */
  async function getSharedKeyFor(otherUserId: string): Promise<CryptoKey | null> {
    if (sharedKeyCacheRef.current[otherUserId]) return sharedKeyCacheRef.current[otherUserId];
    const privateKey = myPrivateKeyRef.current;
    const theirPublicKey = publicKeysRef.current[otherUserId];
    if (!privateKey || !theirPublicKey) return null;
    const key = await deriveSharedKey(privateKey, theirPublicKey);
    sharedKeyCacheRef.current[otherUserId] = key;
    return key;
  }

  function otherIdFor(conv: Conversation | undefined): string | null {
    if (!conv || !userId) return null;
    return conv.participant_one === userId ? conv.participant_two : conv.participant_one;
  }

  /** Decrypts a raw message row from the DB for display. Legacy plaintext
   * messages (encrypted === false) pass through unchanged. */
  async function decryptIncoming(m: Message): Promise<Message> {
    if (!m.encrypted || !m.iv) return m;
    const conv = conversationsRef.current.find((c) => c.id === m.conversation_id);
    const otherId = otherIdFor(conv);
    if (!otherId) return { ...m, content: "🔒 Encrypted message" };
    const key = await getSharedKeyFor(otherId);
    if (!key) return { ...m, content: "🔒 Encrypted message (key not available on this device)" };
    try {
      const plaintext = await decryptText(key, m.content, m.iv);
      return { ...m, content: plaintext };
    } catch {
      return { ...m, content: "⚠️ Could not decrypt this message" };
    }
  }

  useEffect(() => {
    publicKeysRef.current = publicKeys;
  }, [publicKeys]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    },
    [supabase]
  );

  // Auth check + load conversations
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUserId(data.session.user.id);
      supabase
        .from("profiles")
        .select("username")
        .eq("id", data.session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile?.username) {
            router.replace("/onboarding");
            return;
          }
          setMyUsername(profile.username);
        });

      // Set up (or load) this device's encryption key pair. The private
      // key never leaves the browser; the public key gets uploaded so
      // others can encrypt messages to us.
      ensureKeyPair(data.session.user.id, async (base64PublicKey) => {
        await supabase.from("profiles").update({ public_key: base64PublicKey }).eq("id", data.session.user.id);
      }).then((privateKey) => {
        myPrivateKeyRef.current = privateKey;
        setEncryptionReady(!!privateKey);
      });
    });
    // Ask permission for browser notifications once, quietly — no repeated nagging
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [router, supabase]);

  const loadConversations = useCallback(async () => {
    const res = await authedFetch("/api/conversations");
    if (!res.ok) return;
    const { conversations } = await res.json();
    setConversations(conversations || []);
    if (!activeId && conversations?.length) setActiveId(conversations[0].id);

    // Resolve display names for anyone we don't already have cached
    const otherIds = (conversations || [])
      .map((c: Conversation) => (c.participant_one === userId ? c.participant_two : c.participant_one))
      .filter((id: string) => id && !(id in names));

    if (otherIds.length > 0) {
      const namesRes = await fetch("/api/users/names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...new Set(otherIds)] }),
      });
      if (namesRes.ok) {
        const { names: fetched, publicKeys: fetchedKeys } = await namesRes.json();
        setNames((prev) => ({ ...prev, ...fetched }));
        setPublicKeys((prev) => ({ ...prev, ...fetchedKeys }));
      }
    }
  }, [authedFetch, activeId, userId, names]);

  useEffect(() => {
    if (userId) loadConversations();
  }, [userId, loadConversations]);

  // Handle invite links: /u/[username] redirects here with ?start=username
  useEffect(() => {
    const startUsername = searchParams.get("start");
    if (startUsername && userId && !startHandledRef.current) {
      startHandledRef.current = true;
      startConversation(startUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId]);

  // Load messages for active conversation + subscribe to realtime updates
  useEffect(() => {
    if (!activeId) return;

    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeId)
      .order("sent_at", { ascending: true })
      .then(async ({ data }) => {
        const decrypted = await Promise.all((data || []).map(decryptIncoming));
        setMessages(decrypted);
      });

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            decryptIncoming(payload.new as Message).then((dm) => setMessages((prev) => [...prev, dm]));
          } else if (payload.eventType === "UPDATE") {
            decryptIncoming(payload.new as Message).then((dm) =>
              setMessages((prev) => prev.map((m) => (m.id === dm.id ? dm : m)))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, supabase]);

  // Global notifications: watch for new messages in ANY of the user's
  // conversations (not just the open one) and show a browser notification.
  // Note: this only fires while the tab is open — true push notifications
  // that work when the app is fully closed need a separate server setup
  // (service worker + push subscriptions), which isn't wired up yet.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("global-message-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === userId) return;
        if (msg.conversation_id === activeId && document.hasFocus()) return;

        loadConversations();

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const senderName = names[msg.sender_id] || "New message";
          new Notification(`Aegis AI — ${senderName}`, {
            body: msg.media_url ? "Sent an image" : msg.content.slice(0, 120),
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeId, supabase, names]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Decrypt encrypted images for display. Each ciphertext blob is fetched
  // and decrypted client-side, then turned into a local object URL — the
  // decrypted bytes never touch the server or get written back anywhere.
  useEffect(() => {
    const toDecrypt = messages.filter((m) => m.media_url && m.encrypted && m.iv && !decryptedImageUrls[m.id]);
    if (toDecrypt.length === 0) return;
    (async () => {
      for (const m of toDecrypt) {
        const conv = conversationsRef.current.find((c) => c.id === m.conversation_id);
        const otherId = otherIdFor(conv);
        if (!otherId) continue;
        const key = await getSharedKeyFor(otherId);
        if (!key) continue;
        try {
          const res = await fetch(m.media_url!);
          const bytes = await res.arrayBuffer();
          const objectUrl = await decryptFileToObjectUrl(key, bytes, m.iv!, m.media_mime || "image/jpeg");
          setDecryptedImageUrls((prev) => ({ ...prev, [m.id]: objectUrl }));
        } catch (e) {
          console.error("image decrypt failed", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || !activeId || !userId) return;
    const plaintext = draft;
    setDraft("");

    const conv = conversations.find((c) => c.id === activeId);
    const otherId = otherIdFor(conv);
    const key = otherId ? await getSharedKeyFor(otherId) : null;

    let insertPayload: { conversation_id: string; sender_id: string; content: string; encrypted: boolean; iv?: string };
    if (key) {
      const { content: cipherContent, iv } = await encryptText(key, plaintext);
      insertPayload = { conversation_id: activeId, sender_id: userId, content: cipherContent, encrypted: true, iv };
    } else {
      // Fallback: no shared key available yet (e.g. other person hasn't opened
      // the app on any device since signing up, so has no public key). Sent
      // as plaintext so the conversation still works, clearly not encrypted.
      insertPayload = { conversation_id: activeId, sender_id: userId, content: plaintext, encrypted: false };
    }

    const { data, error } = await supabase.from("messages").insert(insertPayload).select().single();

    if (error) {
      console.error("send failed", error);
      return;
    }

    // Build plaintext context from the messages already decrypted in this
    // session (the server can't decrypt stored ciphertext itself).
    const context = messages.slice(-6).map((m) => ({
      sender: m.sender_id === userId ? ("me" as const) : ("them" as const),
      content: m.content,
    }));

    // Fire-and-forget: analyze in background, never blocks delivery
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: data.id, message_text: plaintext, context }),
    }).catch((e) => console.error("analyze call failed", e));
  }

  async function startConversation(usernameOverride?: string) {
    setStartError("");
    const target = usernameOverride ?? newContactUsername;
    if (!target.trim()) return;
    setStarting(true);

    // Step 1: resolve the username to a user id
    const lookupRes = await fetch("/api/users/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: target.trim() }),
    });
    const lookupJson = await lookupRes.json();
    if (!lookupRes.ok) {
      setStarting(false);
      setStartError(lookupJson.error || "User not found");
      return;
    }

    // Step 2: create or open the conversation with that user id
    const res = await authedFetch("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ other_user_id: lookupJson.id }),
    });
    const json = await res.json();
    setStarting(false);
    if (res.ok) {
      setNames((prev) => ({ ...prev, [lookupJson.id]: lookupJson.display_name }));
      if (lookupJson.public_key) setPublicKeys((prev) => ({ ...prev, [lookupJson.id]: lookupJson.public_key }));
      setNewContactUsername("");
      await loadConversations();
      setActiveId(json.conversation.id);
    } else {
      setStartError(json.error || "Could not start conversation");
    }
  }

  async function deleteMessage(id: string) {
    if (!window.confirm("Delete this message for everyone?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function uploadImage(file: File) {
    if (!activeId || !userId) return;
    setUploading(true);

    const conv = conversations.find((c) => c.id === activeId);
    const otherId = otherIdFor(conv);
    const key = otherId ? await getSharedKeyFor(otherId) : null;

    const ext = file.name.split(".").pop();
    const path = `${activeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    let uploadBody: Blob = file;
    let encrypted = false;
    let iv: string | undefined;

    if (key) {
      const result = await encryptFile(key, file);
      uploadBody = result.blob;
      iv = result.iv;
      encrypted = true;
    }
    // If no shared key is available yet, the image is sent unencrypted so
    // the conversation still works — same documented fallback as text.

    const { error: uploadError } = await supabase.storage.from("message-media").upload(path, uploadBody);
    if (uploadError) {
      setUploading(false);
      setActionMsg("Image upload failed: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("message-media").getPublicUrl(path);

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: userId,
      content: "",
      media_url: urlData.publicUrl,
      media_mime: file.type || "image/jpeg",
      encrypted,
      iv,
    });

    setUploading(false);
    if (insertError) setActionMsg("Could not send image: " + insertError.message);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveEvidence() {
    if (!activeId || selectedIds.size === 0) return;
    setSavingEvidence(true);
    const res = await authedFetch("/api/evidence", {
      method: "POST",
      body: JSON.stringify({ conversation_id: activeId, message_ids: Array.from(selectedIds) }),
    });
    setSavingEvidence(false);
    if (res.ok) {
      exportEvidenceText(Array.from(selectedIds));
      setActionMsg(`Saved ${selectedIds.size} message(s) as evidence and downloaded a copy.`);
      setSelectMode(false);
      setSelectedIds(new Set());
    } else {
      const json = await res.json();
      setActionMsg(json.error || "Could not save evidence");
    }
  }

  function exportEvidenceText(ids: string[]) {
    const selected = messages
      .filter((m) => ids.includes(m.id))
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

    const otherName = active ? otherParticipantName(active) : "Unknown";
    const lines = [
      `Aegis AI — Evidence Report`,
      `Conversation with: ${otherName}`,
      `Exported: ${new Date().toLocaleString()}`,
      `----------------------------------------`,
      ...selected.flatMap((m) => {
        const who = m.sender_id === userId ? "You" : otherName;
        const risk = m.risk_level && m.risk_level !== "low" ? ` [${m.risk_level.toUpperCase()} RISK]` : "";
        const text = m.media_url ? "[image attached]" : m.content;
        const lines = [`[${new Date(m.sent_at).toLocaleString()}] ${who}${risk}: ${text}`];
        if (m.risk_explanation) lines.push(`    Why flagged: ${m.risk_explanation}`);
        if (m.risk_recommendation) lines.push(`    Recommended action: ${m.risk_recommendation}`);
        return lines;
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-ai-evidence-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadTrustedContacts() {
    const res = await authedFetch("/api/trusted-contacts");
    if (res.ok) {
      const json = await res.json();
      setTrustedContacts(json.contacts || []);
    }
  }

  async function addTrustedContact() {
    setTrustedError("");
    if (!newTrustedUsername.trim()) return;
    const res = await authedFetch("/api/trusted-contacts", {
      method: "POST",
      body: JSON.stringify({ username: newTrustedUsername.trim() }),
    });
    if (res.ok) {
      setNewTrustedUsername("");
      await loadTrustedContacts();
    } else {
      const json = await res.json();
      setTrustedError(json.error || "Could not add contact");
    }
  }

  async function removeTrustedContact(contactId: string) {
    await authedFetch("/api/trusted-contacts", { method: "DELETE", body: JSON.stringify({ contact_id: contactId }) });
    await loadTrustedContacts();
  }

  async function blockUser() {
    if (!active || !userId) return;
    const otherId = active.participant_one === userId ? active.participant_two : active.participant_one;
    const res = await authedFetch("/api/users/block", { method: "POST", body: JSON.stringify({ blocked_id: otherId }) });
    if (res.ok) {
      setMenuOpen(false);
      setActiveId(null);
      await loadConversations();
      setActionMsg("User blocked. You won't see this conversation anymore.");
    } else {
      const json = await res.json();
      setActionMsg(json.error || "Could not block user");
    }
  }

  async function reportUser() {
    if (!active || !userId) return;
    const otherId = active.participant_one === userId ? active.participant_two : active.participant_one;
    const reason = window.prompt("Briefly describe why you're reporting this conversation (optional):") || "";
    const res = await authedFetch("/api/users/report", {
      method: "POST",
      body: JSON.stringify({ reported_id: otherId, conversation_id: active.id, reason }),
    });
    setMenuOpen(false);
    if (res.ok) {
      setActionMsg("Report submitted. Thank you for helping keep Aegis AI safe.");
    } else {
      const json = await res.json();
      setActionMsg(json.error || "Could not submit report");
    }
  }

  function otherParticipantName(c: Conversation) {
    const otherId = c.participant_one === userId ? c.participant_two : c.participant_one;
    return names[otherId] || `User ${otherId.slice(0, 8)}`;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const active = conversations.find((c) => c.id === activeId);
  const bg = darkMode ? "#0F1419" : "#0A0F0D";
  const panelBg = darkMode ? "#1A2029" : "#141B18";
  const textColor = darkMode ? "#E5E7EB" : "#E6F4EA";
  const borderColor = darkMode ? "#2A313D" : "#2E4038";

  return (
    <div style={{ height: "100vh", display: "flex", background: bg, color: textColor, fontFamily: "inherit" }}>
      {/* Sidebar */}
      <div style={{ width: 300, borderRight: `1px solid ${borderColor}`, background: panelBg, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px", borderBottom: "1px solid #1A251F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#22C55E", color: "#141B18", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
              A
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Aegis AI</span>
            <button
              onClick={() => router.push("/hub")}
              title="Aegis AI Hub"
              style={{ marginLeft: "auto", fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              🤖
            </button>
            <button
              onClick={() => {
                setInvitePanelOpen((v) => !v);
                setTrustedPanelOpen(false);
              }}
              title="My Invite Link & QR"
              style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              🔗
            </button>
            <button
              onClick={() => {
                setTrustedPanelOpen((v) => !v);
                setInvitePanelOpen(false);
                if (!trustedPanelOpen) loadTrustedContacts();
              }}
              title="Trusted Contacts"
              style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              👥
            </button>
            <button
              onClick={() => window.open("/safety", "_blank")}
              title="Safety Center"
              style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              🛡
            </button>
            <button
              onClick={toggleDarkMode}
              title="Toggle dark mode"
              style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button
              onClick={() => router.push("/settings")}
              title="Settings"
              style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer" }}
            >
              ⚙
            </button>
            <button onClick={signOut} style={{ fontSize: 11, color: "#93A99C", background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </div>

        {invitePanelOpen && (
          <div style={{ padding: 14, borderBottom: "1px solid #1A251F", background: "#0A0F0D" }}>
            {myUsername ? (
              <>
                <div style={{ fontSize: 11, color: "#93A99C", marginBottom: 8 }}>Share this to let others chat with you</div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/u/${myUsername}`
                  )}`}
                  alt="Invite QR code"
                  style={{ borderRadius: 8, border: "1px solid #2E4038", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${myUsername}`}
                    style={{ flex: 1, fontSize: 10.5, padding: "6px 8px", borderRadius: 6, border: "1px solid #2E4038", color: "#A8BDB0", background: "#0F1613" }}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/u/${myUsername}`)}
                    style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, border: "none", background: "#22C55E", color: "#141B18", cursor: "pointer" }}
                  >
                    Copy
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11.5, color: "#93A99C" }}>Set a username to get your invite link.</div>
            )}
          </div>
        )}

        {trustedPanelOpen && (
          <div style={{ padding: 14, borderBottom: "1px solid #1A251F", background: "#0A0F0D" }}>
            <div style={{ fontSize: 11, color: "#93A99C", marginBottom: 6 }}>Trusted contacts can be reached quickly if you feel unsafe</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                value={newTrustedUsername}
                onChange={(e) => setNewTrustedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addTrustedContact()}
                placeholder="username"
                style={{ flex: 1, fontSize: 11.5, padding: "6px 8px", borderRadius: 6, border: "1px solid #2E4038", background: "#0F1613", color: "#E6F4EA" }}
              />
              <button onClick={addTrustedContact} style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: "#22C55E", color: "#141B18", cursor: "pointer" }}>
                Add
              </button>
            </div>
            {trustedError && <div style={{ fontSize: 11, color: "#C0392B", marginBottom: 6 }}>{trustedError}</div>}
            {trustedContacts.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "#93A99C" }}>No trusted contacts yet.</div>
            ) : (
              trustedContacts.map((tc) => (
                <div key={tc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                  <span>
                    {tc.profiles?.display_name || "Unknown"}{" "}
                    <span style={{ color: "#93A99C" }}>@{tc.profiles?.username}</span>
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        setTrustedPanelOpen(false);
                        startConversation(tc.profiles?.username);
                      }}
                      style={{ fontSize: 11, color: "#22C55E", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                    >
                      Message
                    </button>
                    <button
                      onClick={() => removeTrustedContact(tc.contact_id)}
                      style={{ fontSize: 11, color: "#C0392B", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div style={{ padding: 14, borderBottom: "1px solid #1A251F" }}>
          <div style={{ fontSize: 11, color: "#93A99C", marginBottom: 6 }}>Start a chat (enter their @username)</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={newContactUsername}
              onChange={(e) => setNewContactUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && startConversation()}
              placeholder="username"
              style={{ flex: 1, fontSize: 11.5, padding: "6px 8px", borderRadius: 6, border: "1px solid #2E4038", background: "#0F1613", color: "#E6F4EA" }}
            />
            <button
              onClick={startConversation}
              disabled={starting}
              style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 6, border: "none", background: "#22C55E", color: "#141B18", cursor: "pointer" }}
            >
              {starting ? "..." : "Start"}
            </button>
          </div>
          {startError && <div style={{ fontSize: 11, color: "#C0392B", marginTop: 6 }}>{startError}</div>}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 && (
            <div style={{ padding: 18, fontSize: 12, color: "#93A99C" }}>No conversations yet — start one above.</div>
          )}
          {conversations.map((c) => {
            const meta = RISK_META[c.risk_level] || RISK_META.low;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveId(c.id);
                  setMenuOpen(false);
                  setActionMsg("");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: "1px solid #182420",
                  background: c.id === activeId ? "#16211C" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {otherParticipantName(c)}
                  {c.risk_level !== "low" && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!active ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#93A99C", fontSize: 13 }}>
            Select or start a conversation to begin.
          </div>
        ) : (
          <>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid #2E4038", background: "#141B18", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", position: "relative" }}>
              <span>{otherParticipantName(active)}</span>
              <span
                title={
                  otherIdFor(active) && publicKeys[otherIdFor(active)!]
                    ? "End-to-end encrypted: only you and this person can read these messages"
                    : "Not encrypted yet — the other person hasn't set up their encryption key on any device"
                }
                style={{ marginLeft: 8, fontSize: 12 }}
              >
                {otherIdFor(active) && publicKeys[otherIdFor(active)!] ? "🔒" : "🔓"}
              </span>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#93A99C", padding: "0 6px" }}
              >
                ⋮
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", top: 44, right: 22, background: "#141B18", border: "1px solid #2E4038", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 10 }}>
                  <button
                    onClick={() => {
                      setSelectMode(true);
                      setSelectedIds(new Set());
                      setMenuOpen(false);
                    }}
                    style={menuItemStyle}
                  >
                    Select messages for evidence
                  </button>
                  <button onClick={blockUser} style={menuItemStyle}>
                    Block user
                  </button>
                  <button onClick={reportUser} style={{ ...menuItemStyle, color: "#C0392B" }}>
                    Report conversation
                  </button>
                </div>
              )}
            </div>
            {actionMsg && (
              <div style={{ background: "#16211C", color: "#22C55E", fontSize: 12, padding: "8px 22px", borderBottom: "1px solid #2E4038" }}>
                {actionMsg}
              </div>
            )}

            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m) => {
                const mine = m.sender_id === userId;
                const meta = m.risk_level && m.risk_level !== "low" ? RISK_META[m.risk_level] : null;
                const isExpanded = expandedMsg === m.id;
                return (
                  <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "62%", display: "flex", alignItems: "flex-start", gap: 8, flexDirection: mine ? "row-reverse" : "row" }}>
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        style={{ marginTop: 12, cursor: "pointer" }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                    <div
                      style={{
                        background: mine ? "#22C55E" : "#141B18",
                        color: mine ? "#141B18" : "#E6F4EA",
                        border: mine ? "none" : "1px solid #2E4038",
                        borderRadius: 14,
                        padding: m.media_url ? 6 : "10px 14px",
                        fontSize: 13.5,
                      }}
                    >
                      {m.media_url && (
                        m.encrypted ? (
                          decryptedImageUrls[m.id] ? (
                            <img src={decryptedImageUrls[m.id]} alt="Shared image" style={{ maxWidth: "100%", borderRadius: 10, display: "block" }} />
                          ) : (
                            <div style={{ padding: 20, fontSize: 11.5, color: "#93A99C" }}>🔒 Decrypting image...</div>
                          )
                        ) : (
                          <div>
                            <img src={m.media_url} alt="Shared image" style={{ maxWidth: "100%", borderRadius: 10, display: "block" }} />
                            <div style={{ fontSize: 9.5, color: mine ? "#BFD9D6" : "#5C6E63", padding: "3px 6px" }}>🔓 Not encrypted</div>
                          </div>
                        )
                      )}
                      {m.content}
                    </div>
                    {mine && !selectMode && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        style={{ fontSize: 10, color: "#5C6E63", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                      >
                        Delete
                      </button>
                    )}
                    {meta && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => setExpandedMsg(isExpanded ? null : m.id)}
                          style={{ width: "100%", textAlign: "left", background: meta.bg, color: meta.color, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                        >
                          {meta.label} detected {isExpanded ? "▲" : "▼"}
                        </button>
                        {isExpanded && (
                          <div style={{ background: "#121915", border: "1px solid #1A251F", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>
                            {m.risk_explanation && (
                              <div style={{ fontSize: 12, marginBottom: 8 }}>
                                <div style={{ fontWeight: 700, color: "#E6F4EA", marginBottom: 2 }}>Why this is risky</div>
                                <div style={{ color: "#9CB0A2" }}>{m.risk_explanation}</div>
                              </div>
                            )}
                            {m.risk_recommendation && (
                              <div style={{ fontSize: 12, marginBottom: 8 }}>
                                <div style={{ fontWeight: 700, color: "#E6F4EA", marginBottom: 2 }}>Recommended action</div>
                                <div style={{ color: "#9CB0A2" }}>{m.risk_recommendation}</div>
                              </div>
                            )}
                            {!m.risk_explanation && m.risk_reasons && (
                              // Fallback for older messages analyzed before explanations were added
                              m.risk_reasons.map((r, i) => (
                                <div key={i} style={{ fontSize: 11.5, padding: "2px 0" }}>
                                  • {r.label}
                                </div>
                              ))
                            )}
                            {m.risk_level === "high" && (
                              <a
                                href="/safety"
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "#C0392B", textDecoration: "underline" }}
                              >
                                View Safety Center →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectMode ? (
              <div style={{ padding: "14px 20px", borderTop: "1px solid #2E4038", background: "#16211C", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "#E6F4EA", fontWeight: 600 }}>{selectedIds.size} selected</span>
                <button
                  onClick={saveEvidence}
                  disabled={selectedIds.size === 0 || savingEvidence}
                  style={{ marginLeft: "auto", background: "#22C55E", color: "#141B18", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  {savingEvidence ? "Saving..." : "Save as Evidence"}
                </button>
                <button
                  onClick={() => {
                    setSelectMode(false);
                    setSelectedIds(new Set());
                  }}
                  style={{ background: "#1A251F", color: "#C7D9CD", border: "1px solid #3A5245", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ padding: "14px 20px", borderTop: "1px solid #2E4038", background: "#141B18", display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach image"
                  style={{ background: "#182420", border: "none", borderRadius: 10, width: 42, height: 42, fontSize: 16, cursor: "pointer", flexShrink: 0 }}
                >
                  {uploading ? "…" : "📎"}
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid #2E4038", fontSize: 13.5, background: "#0F1613", color: "#E6F4EA" }}
                />
                <button onClick={sendMessage} style={{ background: "#22C55E", color: "#141B18", border: "none", borderRadius: 10, padding: "0 20px", fontWeight: 700, cursor: "pointer" }}>
                  Send
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
