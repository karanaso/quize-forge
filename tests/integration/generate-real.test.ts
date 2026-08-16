import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { createApiClient } from "./http";
import { TEST_TEACHER, BASE_URL } from "./config";
import { encryptWithOneTimeKey } from "@/lib/client-crypto";

loadEnvConfig(process.cwd());

const REAL_KEY = process.env.OPEN_AI_KEY ?? process.env.TEST_OPENAI_KEY;

interface SseEvent {
  event: string;
  data: unknown;
  at: number;
}

function pdfFormData(bytes: Uint8Array): FormData {
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    "011-015.pdf",
  );
  return fd;
}

async function uploadRealPdf(): Promise<{ pdfId: string; pageCount: number }> {
  const client = createApiClient();
  const login = await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  expect(login.status).toBe(200);
  const pdf = readFileSync(resolve(process.cwd(), "tests/011-015.pdf"));
  const res = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: pdfFormData(pdf),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { pdfId: string; pageCount: number };
}

/**
 * Parse an SSE response body into discrete events, capturing arrival time
 * (ms since start) for each. This lets us see exactly where generation stalls.
 */
async function readSse(
  res: Response,
  timeoutMs: number,
): Promise<SseEvent[]> {
  if (!res.body) throw new Error("Response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const start = Date.now();
  const events: SseEvent[] = [];
  let buffer = "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines.
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        events.push({
          event,
          data: data ? JSON.parse(data) : null,
          at: Date.now() - start,
        });
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return events;
}

async function runGenerate(
  pdfId: string,
  pageTo: number,
  apiKey: string,
  timeoutMs: number,
): Promise<{ status: number; contentType: string | null; events: SseEvent[] }> {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);

  const keyRes = await fetch(`${BASE_URL}/api/crypto-key`, { method: "POST" });
  const { requestId, key, iv } = (await keyRes.json()) as {
    requestId: string;
    key: string;
    iv: string;
  };
  const { ciphertext } = await encryptWithOneTimeKey(apiKey, key, iv);

  const res = await client.req("/api/generate", {
    method: "POST",
    body: {
      payload: {
        pdfId,
        pageFrom: 1,
        pageTo,
        questionCount: 10,
        difficulty: "medium",
        timerMinutes: 10,
        shuffleQuestions: true,
        shuffleOptions: true,
      },
      encrypted: { requestId, ciphertext, iv },
    },
  });
  const events = await readSse(res, timeoutMs);
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    events,
  };
}

describe("generate pipeline against tests/011-015.pdf", () => {
  it("streams progress and terminates (does not hang), even with an invalid key", async () => {
    const { pdfId, pageCount } = await uploadRealPdf();
    expect(pageCount).toBe(5);

    const { status, contentType, events } = await runGenerate(
      pdfId,
      2,
      "sk-invalid-key-for-timeout-check",
      90_000,
    );

    for (const ev of events) {
      process.stdout.write(
        `  [t+${String(ev.at).padStart(6)}ms] ${ev.event}: ${JSON.stringify(ev.data)}\n`,
      );
    }

    expect(status).toBe(200);
    expect(contentType).toContain("text/event-stream");
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event).toBe("progress");
    expect(events[events.length - 1].event).toBe("error");
  });

  it.skipIf(!REAL_KEY)(
    "returns drafted questions with a real API key",
    async () => {
      const { pdfId } = await uploadRealPdf();
      const { status, events } = await runGenerate(pdfId, 2, REAL_KEY!, 120_000);

      for (const ev of events) {
        process.stdout.write(
          `  [t+${String(ev.at).padStart(6)}ms] ${ev.event}: ${JSON.stringify(ev.data)}\n`,
        );
      }

      expect(status).toBe(200);
      const done = events.find((e) => e.event === "done");
      expect(done, "expected an SSE 'done' event (got error/hang)").toBeTruthy();
      const draft = done!.data as {
        ok: boolean;
        draft: { title: string; questions: unknown[] };
      };
      expect(draft.ok).toBe(true);
      expect(draft.draft.title.length).toBeGreaterThan(0);
      expect(draft.draft.questions.length).toBeGreaterThan(0);
    },
  );
});
