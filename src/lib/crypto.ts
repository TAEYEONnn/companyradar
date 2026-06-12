"use client";

const KEY_PREFIX = "enc_key_";

export async function getEncryptionKey(userId: string): Promise<CryptoKey> {
  const storageKey = KEY_PREFIX + userId;
  const stored =
    typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

  if (stored) {
    try {
      const jwk = JSON.parse(stored) as JsonWebKey;
      return await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    } catch {
      // corrupted — regenerate
    }
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify(jwk));
  }
  return key;
}

// → "v1:<b64iv>.<b64ct>" or "" if plaintext is empty
export async function encryptNote(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  if (!plaintext.trim()) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const b64iv = btoa(String.fromCharCode(...iv));
  const b64ct = btoa(String.fromCharCode(...new Uint8Array(ct)));
  return `v1:${b64iv}.${b64ct}`;
}

// → plaintext, "" on empty, error string on key mismatch
export async function decryptNote(
  key: CryptoKey,
  ciphertext: string,
): Promise<string> {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith("v1:")) return ciphertext; // legacy plain text passthrough
  try {
    const payload = ciphertext.slice(3);
    const dotIdx = payload.indexOf(".");
    if (dotIdx === -1) return "";
    const b64iv = payload.slice(0, dotIdx);
    const b64ct = payload.slice(dotIdx + 1);
    const iv = Uint8Array.from(atob(b64iv), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(b64ct), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return "[복호화 실패 — 이 기기의 암호화 키와 다릅니다]";
  }
}

export async function exportEncryptionKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return btoa(JSON.stringify(jwk));
}

export async function importAndSaveEncryptionKey(
  userId: string,
  b64: string,
): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(b64.trim())) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(jwk));
  }
  return key;
}

export async function getKeyFingerprint(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const raw = new TextEncoder().encode((jwk as { k?: string }).k ?? "");
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).slice(0, 8);
}
