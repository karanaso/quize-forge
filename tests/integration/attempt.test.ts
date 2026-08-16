import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { makeTestPdf } from "./fixtures";
import { TEST_TEACHER, BASE_URL } from "./config";

interface QuizPayload {
  title: string;
  pdfId: string;
  pageFrom: number;
  pageTo: number;
  difficulty: "easy" | "medium" | "hard";
  language: string;
  questions: Array<Record<string, unknown>>;
  config: Record<string, unknown>;
  status: "draft" | "published";
}

async function createQuizWithStatus(status: "draft" | "published") {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  const pdf = await makeTestPdf(1);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    "attempt.pdf",
  );
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: fd,
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };

  const payload: QuizPayload = {
    title: "Attempt quiz",
    pdfId,
    pageFrom: 1,
    pageTo: 1,
    difficulty: "easy",
    language: "English",
    questions: [
      {
        id: "q1",
        kind: "mc",
        text: "Pick B",
        options: ["A", "B", "C", "D"],
        correctIndex: 1,
        points: 2,
        explanation: "",
      },
      {
        id: "q2",
        kind: "tf",
        text: "True statement",
        correct: true,
        points: 1,
        explanation: "",
      },
    ],
    config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
    status,
  };

  const create = await client.req("/api/quiz", { method: "POST", body: payload });
  const { id } = (await create.json()) as { id: string };
  return { client, quizId: id };
}

function attemptBody(quizId: string, answers: Array<Record<string, unknown>>) {
  return {
    quizId,
    identity: { school: "Springfield", className: "9A", studentName: "Lisa" },
    answers,
    startedAt: "2026-01-01T10:00:00.000Z",
  };
}

describe("attempt grading", () => {
  it("grades a perfect attempt and stores it", async () => {
    const { quizId } = await createQuizWithStatus("published");
    const res = await fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        attemptBody(quizId, [
          { questionId: "q1", kind: "mc", selectedIndex: 1 },
          { questionId: "q2", kind: "tf", value: true },
        ]),
      ),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      score: number;
      totalPoints: number;
      correctCount: number;
    };
    expect(body.score).toBe(3);
    expect(body.totalPoints).toBe(3);
    expect(body.correctCount).toBe(2);
  });

  it("grades a partial attempt", async () => {
    const { quizId } = await createQuizWithStatus("published");
    const res = await fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        attemptBody(quizId, [{ questionId: "q1", kind: "mc", selectedIndex: 0 }]),
      ),
    });
    const body = (await res.json()) as { score: number; correctCount: number };
    expect(body.score).toBe(0);
    expect(body.correctCount).toBe(0);
  });

  it("rejects attempts for draft quizzes", async () => {
    const { quizId } = await createQuizWithStatus("draft");
    const res = await fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(attemptBody(quizId, [])),
    });
    expect(res.status).toBe(404);
  });

  it("rejects invalid attempt payloads", async () => {
    const res = await fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quizId: "nope" }),
    });
    expect(res.status).toBe(400);
  });
});
