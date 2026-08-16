import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { makeTestPdf, pdfFormData } from "./fixtures";
import { TEST_TEACHER } from "./config";

describe("pdf upload", () => {
  it("rejects requests without a file", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req("/api/pdf/upload", {
      method: "POST",
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-PDF files", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([Buffer.from("hello world")], { type: "text/plain" }),
      "notes.txt",
    );
    const res = await client.req("/api/pdf/upload", {
      method: "POST",
      formData: fd,
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid PDF bytes", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([Buffer.from("not really a pdf at all")], {
        type: "application/pdf",
      }),
      "broken.pdf",
    );
    const res = await client.req("/api/pdf/upload", {
      method: "POST",
      formData: fd,
    });
    expect(res.status).toBe(422);
  });

  it("rejects PDFs over 20 pages", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const pdf = await makeTestPdf(21);
    const res = await client.req("/api/pdf/upload", {
      method: "POST",
      formData: pdfFormData(pdf, "many.pdf"),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/maximum is 20/);
  });

  it("uploads a valid 2-page PDF and returns pageCount", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const pdf = await makeTestPdf(2);
    const res = await client.req("/api/pdf/upload", {
      method: "POST",
      formData: pdfFormData(pdf),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { pdfId: string; pageCount: number };
    expect(body.pageCount).toBe(2);
    expect(body.pdfId).toMatch(/^[a-f0-9]{24}$/);
  });
});
