import { describe, expect, it } from "vitest";
import { createOneTimeKey, decryptOneTimeKey } from "@/lib/crypto";
import { encryptWithOneTimeKey } from "@/lib/client-crypto";

describe("one-time encryption keys", () => {
  it("issues a unique key with base64 key and iv", () => {
    const a = createOneTimeKey();
    const b = createOneTimeKey();
    expect(a.requestId).not.toBe(b.requestId);
    expect(a.key).not.toBe(b.key);
    expect(Buffer.from(a.key, "base64")).toHaveLength(32);
    expect(Buffer.from(a.iv, "base64")).toHaveLength(12);
  });

  it("round-trips an api key through client and server crypto", async () => {
    const { requestId, key, iv } = createOneTimeKey();
    const { ciphertext } = await encryptWithOneTimeKey("sk-test-123", key, iv);
    expect(decryptOneTimeKey(requestId, ciphertext, iv)).toBe("sk-test-123");
  });

  it("consumes the key after a single use", async () => {
    const { requestId, key, iv } = createOneTimeKey();
    const { ciphertext } = await encryptWithOneTimeKey("sk-test", key, iv);
    expect(decryptOneTimeKey(requestId, ciphertext, iv)).toBe("sk-test");
    expect(decryptOneTimeKey(requestId, ciphertext, iv)).toBeNull();
  });

  it("rejects unknown request ids", async () => {
    const { key, iv } = createOneTimeKey();
    const { ciphertext } = await encryptWithOneTimeKey("sk-test", key, iv);
    expect(decryptOneTimeKey("not-a-real-id", ciphertext, iv)).toBeNull();
  });

  it("rejects tampered ciphertext", async () => {
    const { requestId, key, iv } = createOneTimeKey();
    const { ciphertext } = await encryptWithOneTimeKey("sk-test", key, iv);
    const tampered = ciphertext.slice(0, -8) + "AAAAAAAA";
    expect(decryptOneTimeKey(requestId, tampered, iv)).toBeNull();
  });

  it("rejects a tampered iv", async () => {
    const { requestId, key, iv } = createOneTimeKey();
    const { ciphertext } = await encryptWithOneTimeKey("sk-test", key, iv);
    const badIv = Buffer.from(iv, "base64").reverse().toString("base64");
    expect(decryptOneTimeKey(requestId, ciphertext, badIv)).toBeNull();
  });
});
