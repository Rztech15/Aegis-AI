/**
 * Client-side end-to-end message encryption.
 *
 * PRIVACY MODEL — read this before relying on it:
 * - Each user has an ECDH (P-256) key pair. The PRIVATE key never leaves
 *   the browser and is stored only in IndexedDB on this device. The public
 *   key is stored in the `profiles` table so others can encrypt to you.
 * - For a 1-to-1 conversation, both sides derive the SAME AES-256 key from
 *   (their private key + the other person's public key) via ECDH — this
 *   is standard Diffie-Hellman key agreement, not a key sent over the wire.
 * - Message CONTENT is encrypted before it ever leaves the browser and is
 *   stored as ciphertext in the database. Supabase, the database, and
 *   anyone with DB access see only ciphertext.
 * - IMPORTANT LIMITATION: this is not the full Signal Protocol. There is
 *   no forward secrecy (one compromised key can decrypt past messages),
 *   no multi-device sync, and no out-of-band key verification ("safety
 *   numbers"). Losing this browser's storage (clearing data, new device)
 *   means old messages become permanently unreadable — there is no key
 *   recovery built.
 * - The AI safety analysis still needs to read plaintext to work. That
 *   happens transiently: the browser decrypts messages to display them
 *   anyway, and sends that already-decrypted text directly to the
 *   analysis endpoint for scanning. The server never stores plaintext,
 *   but it does see it briefly in memory during analysis — this is a
 *   deliberate, documented tradeoff, not an oversight.
 */

const DB_NAME = "aegis-ai-keys";
const STORE_NAME = "keys";

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openKeyStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Ensures this device has a key pair for the given user. Generates one and
 * uploads the public key on first use; otherwise loads the existing
 * private key from IndexedDB. Returns the private CryptoKey for deriving
 * shared keys, or null if something went wrong (encryption unavailable).
 */
export async function ensureKeyPair(
  userId: string,
  uploadPublicKey: (base64PublicKey: string) => Promise<void>
): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;

  const existing = await idbGet<CryptoKey>(`private:${userId}`);
  if (existing) return existing;

  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicRaw = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  await uploadPublicKey(toBase64(publicRaw));
  await idbSet(`private:${userId}`, keyPair.privateKey);
  return keyPair.privateKey;
}

async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", fromBase64(base64), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/** Derives the shared AES-256-GCM key for a conversation between two users. */
export async function deriveSharedKey(myPrivateKey: CryptoKey, theirPublicKeyBase64: string): Promise<CryptoKey> {
  const theirPublicKey = await importPublicKey(theirPublicKeyBase64);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<{ content: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { content: toBase64(ciphertext), iv: toBase64(iv.buffer) };
}

export async function decryptText(key: CryptoKey, contentBase64: string, ivBase64: string): Promise<string> {
  const iv = fromBase64(ivBase64);
  const ciphertext = fromBase64(contentBase64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/** Encrypts raw file bytes (used for images). Returns the encrypted bytes
 * as a Blob (ready to upload) and the IV needed to decrypt it later. */
export async function encryptFile(key: CryptoKey, file: File): Promise<{ blob: Blob; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBytes = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileBytes);
  return { blob: new Blob([ciphertext]), iv: toBase64(iv.buffer) };
}

/** Decrypts encrypted file bytes fetched from storage back into a
 * displayable object URL, given the IV and the original MIME type. */
export async function decryptFileToObjectUrl(
  key: CryptoKey,
  encryptedBytes: ArrayBuffer,
  ivBase64: string,
  mimeType: string
): Promise<string> {
  const iv = fromBase64(ivBase64);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBytes);
  const blob = new Blob([decrypted], { type: mimeType || "image/jpeg" });
  return URL.createObjectURL(blob);
}
