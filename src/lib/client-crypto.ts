function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Encrypt the teacher's AI key with a server-issued one-time AES-GCM key.
 * Returns ciphertext in the format "<base64 data>.<base64 auth tag>".
 */
export async function encryptWithOneTimeKey(
  plaintext: string,
  keyB64: string,
  ivB64: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(keyB64) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = base64ToBytes(ivB64) as BufferSource;
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

  const bytes = new Uint8Array(encrypted);
  const tag = bytes.slice(bytes.length - 16);
  const payload = bytes.slice(0, bytes.length - 16);
  return {
    ciphertext: `${bytesToBase64(payload)}.${bytesToBase64(tag)}`,
    iv: ivB64,
  };
}
