import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";

/**
 * One-time AES-256-GCM keys issued to the frontend so it can encrypt the
 * teacher's AI API key before sending it to the backend. Keys are short-lived,
 * stored in memory only, and never persisted or shipped to the browser.
 */
const keyStore = new Map<
  string,
  { key: Buffer; iv: Buffer; expiresAt: number }
>();

const KEY_TTL_MS = 5 * 60 * 1000;

export function createOneTimeKey(): {
  requestId: string;
  key: string;
  iv: string;
} {
  const requestId = randomBytes(16).toString("hex");
  const key = randomBytes(32);
  const iv = randomBytes(12);
  keyStore.set(requestId, {
    key,
    iv,
    expiresAt: Date.now() + KEY_TTL_MS,
  });
  return {
    requestId,
    key: key.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptOneTimeKey(
  requestId: string,
  ciphertext: string,
  ivB64: string,
): string | null {
  const entry = keyStore.get(requestId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    keyStore.delete(requestId);
    return null;
  }
  keyStore.delete(requestId);

  const iv = Buffer.from(ivB64, "base64");
  try {
    const decipher = createDecipheriv(ALGO, entry.key, iv);
    const authTag = Buffer.from(ciphertext.split(".").pop() ?? "", "base64");
    const data = Buffer.from(
      ciphertext.slice(0, ciphertext.lastIndexOf(".")),
      "base64",
    );
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export { timingSafeEqual };
