import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { createApiClient } from "./http";
import { TEST_MONGODB_URI, TEST_TEACHER } from "./config";
import { makeTestPdf, pdfFormData } from "./fixtures";
import { deriveUserId } from "@/lib/auth";

async function db() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(TEST_MONGODB_URI);
  }
  return mongoose.connection.db!;
}

async function login() {
  const client = createApiClient();
  const res = await client.login(TEST_TEACHER.username, TEST_TEACHER.password);
  expect(res.status).toBe(200);
  return client;
}

async function createQuiz(client: ReturnType<typeof createApiClient>) {
  const pdf = await makeTestPdf(2);
  const upload = await client.req("/api/pdf/upload", {
    method: "POST",
    formData: pdfFormData(pdf),
  });
  const { pdfId } = (await upload.json()) as { pdfId: string };

  const create = await client.req("/api/quiz", {
    method: "POST",
    body: {
      title: "Ownership quiz",
      pdfId,
      sourceFilename: "test.pdf",
      pageFrom: 1,
      pageTo: 2,
      difficulty: "medium",
      language: "English",
      questions: [
        {
          id: "q1",
          kind: "tf",
          text: "Water is wet.",
          correct: true,
          points: 1,
          explanation: "",
        },
      ],
      config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
      status: "draft",
    },
  });
  expect(create.status).toBe(201);
  const { id } = (await create.json()) as { id: string };
  return id;
}

describe("quiz ownership", () => {
  it("stamps new quizzes with the owner's userId", async () => {
    const client = await login();
    const quizId = await createQuiz(client);

    const doc = await (await db())
      .collection("quizzes")
      .findOne({ _id: new mongoose.Types.ObjectId(quizId) });
    expect(doc?.ownerId).toBe(deriveUserId(TEST_TEACHER.username));

    await (await db()).collection("quizzes").deleteOne({ _id: doc!._id });
  });

  it("adopts unowned legacy quizzes on the next authenticated request", async () => {
    await (
      await db()
    ).collection("quizzes").insertOne({
      title: "Legacy unowned quiz",
      pageFrom: 1,
      pageTo: 1,
      difficulty: "easy",
      language: "English",
      questions: [],
      config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const client = await login();
    const list = await client.req("/api/quiz");
    expect(list.status).toBe(200);
    const { quizzes } = (await list.json()) as { quizzes: { title: string }[] };
    expect(quizzes.some((q) => q.title === "Legacy unowned quiz")).toBe(true);

    const adopted = await (
      await db()
    ).collection("quizzes").findOne({ title: "Legacy unowned quiz" });
    expect(adopted?.ownerId).toBe(deriveUserId(TEST_TEACHER.username));
  });

  it("hides quizzes owned by another user", async () => {
    const client = await login();
    const quizId = await createQuiz(client);

    const coll = (await db()).collection("quizzes");
    await coll.updateOne(
      { _id: new mongoose.Types.ObjectId(quizId) },
      { $set: { ownerId: deriveUserId("someone-else") } },
    );

    const list = await client.req("/api/quiz");
    const { quizzes } = (await list.json()) as { quizzes: { id: string }[] };
    expect(quizzes.some((q) => q.id === quizId)).toBe(false);

    const single = await client.req(`/api/quiz/${quizId}`);
    expect(single.status).toBe(404);

    await coll.deleteOne({ _id: new mongoose.Types.ObjectId(quizId) });
  });
});
