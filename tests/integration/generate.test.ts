import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { makeTestPdf } from "./fixtures";
import { TEST_TEACHER, BASE_URL } from "./config";
import { encryptWithOneTimeKey } from "@/lib/client-crypto";

async function seedPdf(): Promise<{ pdfId: string }> {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  const pdf = await makeTestPdf(2);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    "generate.pdf",
  );
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: fd,
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };
  return { pdfId };
}

async function getEncryptionKey() {
  const res = await fetch(`${BASE_URL}/api/crypto-key`, { method: "POST" });
  return (await res.json()) as { requestId: string; key: string; iv: string };
}

async function generatePayload(
  client: ReturnType<typeof createApiClient>,
  pdfId: string,
  pageTo: number,
) {
  const { requestId, key, iv } = await getEncryptionKey();
  const { ciphertext } = await encryptWithOneTimeKey("sk-dummy-key", key, iv);
  return client.req("/api/generate", {
    method: "POST",
    body: {
      payload: {
        pdfId,
        pageFrom: 1,
        pageTo,
        questionCount: 5,
        difficulty: "medium",
        timerMinutes: 10,
      },
      encrypted: { requestId, ciphertext, iv },
    },
  });
}

describe("generate SSE pipeline", () => {
  it("rejects a payload without a valid encryption key", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const { pdfId } = await seedPdf();
    const res = await client.req("/api/generate", {
      method: "POST",
      body: {
        payload: { pdfId, pageFrom: 1, pageTo: 2, questionCount: 5 },
        encrypted: { requestId: "unknown", ciphertext: "x.y", iv: "iv" },
      },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an out-of-range page selection", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const { pdfId } = await seedPdf();
    const res = await generatePayload(client, pdfId, 20);
    expect(res.status).toBe(400);
  });

  it("rejects a missing payload", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req("/api/generate", {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("streams an SSE response that terminates with an error for a dummy key", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const { pdfId } = await seedPdf();
    const res = await generatePayload(client, pdfId, 2);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: progress");
    expect(text).toContain("event: error");
    expect(text).toContain("data: ");
  });
});
