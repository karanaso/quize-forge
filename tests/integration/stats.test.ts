import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { makeTestPdf } from "./fixtures";
import { TEST_TEACHER, BASE_URL } from "./config";

async function seedAttempts(): Promise<{ quizId: string }> {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  const pdf = await makeTestPdf(1);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    "stats.pdf",
  );
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: fd,
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };

  const questions = [
    {
      id: "q1",
      kind: "mc",
      text: "Pick B",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      points: 1,
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
  ];
  const create = await client.req("/api/quiz", {
    method: "POST",
    body: {
      title: "Stats quiz",
      pdfId,
      sourceFilename: "stats.pdf",
      pageFrom: 1,
      pageTo: 1,
      difficulty: "easy",
      language: "English",
      questions,
      config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
      status: "published",
    },
  });
  const { id } = (await create.json()) as { id: string };

  const submit = (
    name: string,
    answers: Array<Record<string, unknown>>,
  ): Promise<Response> =>
    fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quizId: id,
        identity: { school: "Springfield", className: "9A", studentName: name },
        answers,
        startedAt: new Date().toISOString(),
      }),
    });

  await submit("Lisa", [
    { questionId: "q1", kind: "mc", selectedIndex: 1 },
    { questionId: "q2", kind: "tf", value: true },
  ]);
  await submit("Lisa", [
    { questionId: "q1", kind: "mc", selectedIndex: 1 },
    { questionId: "q2", kind: "tf", value: false },
  ]);
  await submit("Bart", [
    { questionId: "q1", kind: "mc", selectedIndex: 0 },
    { questionId: "q2", kind: "tf", value: true },
  ]);

  return { quizId: id };
}

describe("stats and results", () => {
  it("reports best attempt per student", async () => {
    const { quizId } = await seedAttempts();
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req(`/api/quiz/${quizId}/attempts`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      students: Array<{
        studentName: string;
        score: number;
        attempts: number;
      }>;
    };
    expect(body.students).toHaveLength(2);
    const lisa = body.students.find((s) => s.studentName === "Lisa")!;
    expect(lisa.score).toBe(2);
    expect(lisa.attempts).toBe(2);
  });

  it("computes per-question stats excluding the requesting student", async () => {
    const { quizId } = await seedAttempts();
    const res = await fetch(
      `${BASE_URL}/api/quiz/${quizId}/stats?school=Springfield&class=9A&student=Lisa`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      stats: Record<
        string,
        { correct: number; total: number; percent: number }
      >;
    };
    expect(body.stats.q1).toEqual({ correct: 0, total: 1, percent: 0 });
    expect(body.stats.q2).toEqual({ correct: 1, total: 1, percent: 100 });
  });

  it("returns attempt response with per-question correctness", async () => {
    const { quizId } = await seedAttempts();
    const res = await fetch(`${BASE_URL}/api/attempt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quizId,
        identity: { school: "S2", className: "9B", studentName: "Maggie" },
        answers: [{ questionId: "q1", kind: "mc", selectedIndex: 1 }],
        startedAt: new Date().toISOString(),
      }),
    });
    const body = (await res.json()) as {
      graded: Array<{ questionId: string; correct: boolean }>;
    };
    expect(body.graded.find((g) => g.questionId === "q1")?.correct).toBe(true);
    expect(body.graded.find((g) => g.questionId === "q2")?.correct).toBe(false);
  });
});
