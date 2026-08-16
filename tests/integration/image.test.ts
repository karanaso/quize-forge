import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { createApiClient } from "./http";
import { makeTestPdf } from "./fixtures";
import { TEST_TEACHER, BASE_URL, TEST_MONGODB_URI } from "./config";

async function uploadAndGetGridfsId() {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  const pdf = await makeTestPdf(1);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    "image.pdf",
  );
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: fd,
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };

  await mongoose.connect(TEST_MONGODB_URI);
  try {
    const doc = await mongoose.connection.db
      ?.collection("pdfs")
      .findOne({ _id: new mongoose.Types.ObjectId(pdfId) });
    return { pdfBytes: new Uint8Array(pdf), gridfsId: String(doc?.gridfsId) };
  } finally {
    await mongoose.disconnect();
  }
}

describe("image serving", () => {
  it("serves a stored GridFS file by id", async () => {
    const { pdfBytes, gridfsId } = await uploadAndGetGridfsId();
    expect(gridfsId).toMatch(/^[a-f0-9]{24}$/);
    const res = await fetch(`${BASE_URL}/api/image/${gridfsId}`);
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(pdfBytes.length);
  });

  it("returns 404 for unknown ids", async () => {
    const res = await fetch(`${BASE_URL}/api/image/000000000000000000000000`);
    expect(res.status).toBe(404);
  });
});
