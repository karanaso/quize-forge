import { describe, expect, it } from "vitest";
import { createApiClient } from "./http";
import { makeTestPdf } from "./fixtures";
import { TEST_TEACHER, BASE_URL } from "./config";
import type { PersistedQuestion } from "@/lib/schemas";

interface QuizListItem {
  id: string;
  title: string;
  status: string;
  questionCount: number;
}

function makeQuestions(): PersistedQuestion[] {
  return [
    {
      id: "q1",
      kind: "mc",
      text: "What is the powerhouse of the cell?",
      options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
      correctIndex: 1,
      points: 2,
      explanation: "",
    },
    {
      id: "q2",
      kind: "tf",
      text: "Water boils at 100°C at sea level.",
      correct: true,
      points: 1,
      explanation: "",
    },
    {
      id: "q3",
      kind: "fill",
      text: "The powerhouse of the cell is the ____.",
      blank: "mitochondria",
      acceptableAnswers: ["mitochondria", "mitochondrion"],
      points: 2,
      explanation: "",
    },
  ];
}

async function uploadPdfAndCreateQuiz() {
  const client = createApiClient();
  await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  const pdf = await makeTestPdf(2);
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: pdfFormData(pdf),
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };

  const create = await client.req("/api/quiz", {
    method: "POST",
    body: {
      title: "Biology quiz",
      pdfId,
      sourceFilename: "test.pdf",
      pageFrom: 1,
      pageTo: 2,
      difficulty: "medium",
      language: "English",
      questions: makeQuestions(),
      config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
      status: "draft",
    },
  });
  const body = (await create.json()) as { id: string };
  return { client, quizId: body.id };
}

function pdfFormData(bytes: Uint8Array) {
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    "test.pdf",
  );
  return fd;
}

describe("quiz CRUD", () => {
  it("creates, lists, reads, publishes, and deletes a quiz", async () => {
    const { client, quizId } = await uploadPdfAndCreateQuiz();

    const list = await client.req("/api/quiz");
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { quizzes: QuizListItem[] };
    const item = listBody.quizzes.find((q) => q.id === quizId);
    expect(item).toBeDefined();
    expect(item!.questionCount).toBe(3);
    expect(item!.status).toBe("draft");

    const single = await client.req(`/api/quiz/${quizId}`);
    expect(single.status).toBe(200);
    const singleBody = (await single.json()) as { quiz: { title: string } };
    expect(singleBody.quiz.title).toBe("Biology quiz");

    const publicDraft = await fetch(
      `${BASE_URL}/api/quiz/${quizId}/public`,
    );
    expect(publicDraft.status).toBe(404);

    const update = await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { status: "published" },
    });
    expect(update.status).toBe(200);

    const publicQuiz = await fetch(
      `${BASE_URL}/api/quiz/${quizId}/public`,
    );
    expect(publicQuiz.status).toBe(200);
    const pub = (await publicQuiz.json()) as {
      quiz: { questions: Array<Record<string, unknown>> };
    };
    expect(pub.quiz.questions).toHaveLength(3);
    for (const q of pub.quiz.questions) {
      expect(q.correctIndex).toBeUndefined();
      expect(q.correct).toBeUndefined();
      expect(q.acceptableAnswers).toBeUndefined();
      expect(q.pairs).toBeUndefined();
    }
  });

  it("validates quiz payloads", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req("/api/quiz", {
      method: "POST",
      body: { title: "No questions" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown quiz ids", async () => {
    const client = createApiClient();
    await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
    const res = await client.req("/api/quiz/000000000000000000000000");
    expect(res.status).toBe(404);
  });
});

describe("quiz video URL", () => {
  it("accepts a valid videoUrl and exposes it in the public payload", async () => {
    const { client, quizId } = await uploadPdfAndCreateQuiz();

    const update = await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    expect(update.status).toBe(200);

    await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { status: "published" },
    });

    const pub = await fetch(`${BASE_URL}/api/quiz/${quizId}/public`);
    expect(pub.status).toBe(200);
    const body = (await pub.json()) as { quiz: { videoUrl?: string } };
    expect(body.quiz.videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("rejects an invalid videoUrl with 400", async () => {
    const { client, quizId } = await uploadPdfAndCreateQuiz();
    const res = await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { videoUrl: "https://vimeo.com/12345" },
    });
    expect(res.status).toBe(400);
  });

  it("clears the videoUrl when an empty value is saved", async () => {
    const { client, quizId } = await uploadPdfAndCreateQuiz();

    await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { videoUrl: "https://youtu.be/dQw4w9WgXcQ" },
    });
    const clear = await client.req(`/api/quiz/${quizId}`, {
      method: "PUT",
      body: { videoUrl: "" },
    });
    expect(clear.status).toBe(200);

    const single = await client.req(`/api/quiz/${quizId}`);
    expect(single.status).toBe(200);
    const { quiz } = (await single.json()) as { quiz: { videoUrl?: string } };
    expect(quiz.videoUrl).toBeUndefined();
  });
});
