import { describe, expect, it } from "vitest";
import {
  mcQuestionSchema,
  tfQuestionSchema,
  fillQuestionSchema,
  matchingQuestionSchema,
  persistedQuestionSchema,
  quizConfigSchema,
  studentIdentitySchema,
  attemptSchema,
  generationRequestSchema,
  encryptedPayloadSchema,
} from "@/lib/schemas";

describe("question schemas", () => {
  it("validates an mc question and rejects bad option counts", () => {
    expect(mcQuestionSchema.safeParse({
      kind: "mc",
      text: "Q",
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
    }).success).toBe(true);

    expect(mcQuestionSchema.safeParse({
      kind: "mc",
      text: "Q",
      options: ["a", "b", "c"],
      correctIndex: 0,
    }).success).toBe(false);
  });

  it("rejects an out-of-range correctIndex", () => {
    expect(mcQuestionSchema.safeParse({
      kind: "mc",
      text: "Q",
      options: ["a", "b", "c", "d"],
      correctIndex: 4,
    }).success).toBe(false);
  });

  it("validates tf with a boolean answer", () => {
    expect(tfQuestionSchema.safeParse({ kind: "tf", text: "T", correct: true }).success).toBe(true);
    expect(tfQuestionSchema.safeParse({ kind: "tf", text: "T", correct: "yes" }).success).toBe(false);
  });

  it("requires at least one acceptable fill answer and at most five", () => {
    expect(fillQuestionSchema.safeParse({
      kind: "fill",
      text: "___",
      blank: "x",
      acceptableAnswers: ["x"],
    }).success).toBe(true);

    expect(fillQuestionSchema.safeParse({
      kind: "fill",
      text: "___",
      blank: "x",
      acceptableAnswers: [],
    }).success).toBe(false);
  });

  it("requires 2-8 matching pairs", () => {
    expect(matchingQuestionSchema.safeParse({
      kind: "matching",
      pairs: [{ left: "a", right: "1" }],
    }).success).toBe(false);

    expect(matchingQuestionSchema.safeParse({
      kind: "matching",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
      ],
    }).success).toBe(true);
  });

  it("defaults explanation and optional text", () => {
    const parsed = matchingQuestionSchema.parse({
      kind: "matching",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
      ],
    });
    expect(parsed.explanation).toBe("");
    expect(parsed.text).toBe("");
  });
});

describe("persistedQuestionSchema", () => {
  it("requires id and points", () => {
    expect(persistedQuestionSchema.safeParse({
      kind: "tf",
      text: "T",
      correct: true,
    }).success).toBe(false);

    const parsed = persistedQuestionSchema.parse({
      kind: "tf",
      id: "q1",
      text: "T",
      correct: true,
    });
    expect(parsed.points).toBe(1);
  });

  it("rejects matching questions with duplicate terms", () => {
    const duplicate = persistedQuestionSchema.safeParse({
      kind: "matching",
      id: "q1",
      pairs: [
        { left: "a", right: "1" },
        { left: "a", right: "2" },
      ],
    });
    expect(duplicate.success).toBe(false);
  });
});

describe("quizConfigSchema", () => {
  it("bounds timer minutes", () => {
    expect(quizConfigSchema.safeParse({ timerMinutes: 0 }).success).toBe(false);
    expect(quizConfigSchema.safeParse({ timerMinutes: 181 }).success).toBe(false);
    const parsed = quizConfigSchema.parse({ timerMinutes: 25 });
    expect(parsed.shuffleQuestions).toBe(true);
  });
});

describe("studentIdentitySchema", () => {
  it("rejects empty identity fields", () => {
    expect(studentIdentitySchema.safeParse({ school: "", className: "9A", studentName: "N" }).success).toBe(false);
  });
});

describe("attemptSchema", () => {
  it("coerces an ISO startedAt string to a date", () => {
    const parsed = attemptSchema.parse({
      quizId: "64f000000000000000000000",
      identity: { school: "S", className: "C", studentName: "N" },
      answers: [
        { questionId: "q1", kind: "mc", selectedIndex: 0 },
        { questionId: "q2", kind: "tf", value: true },
      ],
      startedAt: "2026-01-01T10:00:00.000Z",
    });
    expect(parsed.startedAt).toBeInstanceOf(Date);
  });

  it("rejects answers that do not match their kind", () => {
    const result = attemptSchema.safeParse({
      quizId: "64f000000000000000000000",
      identity: { school: "S", className: "C", studentName: "N" },
      answers: [{ questionId: "q1", kind: "mc", value: true }],
      startedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

describe("generationRequestSchema", () => {
  it("applies defaults", () => {
    const parsed = generationRequestSchema.parse({
      pdfId: "64f000000000000000000000",
      pageFrom: 1,
      pageTo: 2,
    });
    expect(parsed.questionCount).toBe(10);
    expect(parsed.difficulty).toBe("medium");
    expect(parsed.timerMinutes).toBe(10);
    expect(parsed.uiLang).toBe("en");
  });

  it("bounds question count and page range", () => {
    expect(generationRequestSchema.safeParse({
      pdfId: "x",
      pageFrom: 1,
      pageTo: 1,
      questionCount: 51,
    }).success).toBe(false);
    expect(generationRequestSchema.safeParse({
      pdfId: "x",
      pageFrom: 1,
      pageTo: 1,
      questionCount: 0,
    }).success).toBe(false);
  });
});

describe("encryptedPayloadSchema", () => {
  it("requires requestId, ciphertext and iv", () => {
    expect(encryptedPayloadSchema.safeParse({
      requestId: "r",
      ciphertext: "c",
      iv: "iv",
    }).success).toBe(true);
    expect(encryptedPayloadSchema.safeParse({ ciphertext: "c" }).success).toBe(false);
  });
});
