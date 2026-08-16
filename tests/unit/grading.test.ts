import { describe, expect, it } from "vitest";
import { gradeAttempt } from "@/lib/grading";
import {
  mcQuestion,
  tfQuestion,
  fillQuestion,
  matchingQuestion,
  makeQuiz,
  mcAnswer,
  tfAnswer,
  fillAnswer,
  matchingAnswer,
} from "./fixtures";

describe("gradeAttempt", () => {
  it("scores a perfect attempt", () => {
    const q1 = mcQuestion();
    const q2 = tfQuestion();
    const quiz = makeQuiz([q1, q2]);
    const result = gradeAttempt(quiz, [
      mcAnswer(q1.id, 1),
      tfAnswer(q2.id, true),
    ]);
    expect(result.score).toBe(3);
    expect(result.totalPoints).toBe(3);
    expect(result.correctCount).toBe(2);
    expect(result.graded.map((g) => g.correct)).toEqual([true, true]);
  });

  it("scores zero for unanswered questions", () => {
    const q1 = mcQuestion();
    const quiz = makeQuiz([q1]);
    const result = gradeAttempt(quiz, []);
    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.graded[0].pointsEarned).toBe(0);
  });

  it("accepts fill answers case-insensitively with whitespace collapsed", () => {
    const q = fillQuestion();
    const quiz = makeQuiz([q]);
    const result = gradeAttempt(quiz, [fillAnswer(q.id, "  MITOCHONDRIA ")]);
    expect(result.graded[0].correct).toBe(true);
    expect(result.score).toBe(2);
  });

  it("rejects a wrong fill answer", () => {
    const q = fillQuestion();
    const quiz = makeQuiz([q]);
    const result = gradeAttempt(quiz, [fillAnswer(q.id, "nucleus")]);
    expect(result.graded[0].correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("grades matching order-insensitively and requires all pairs", () => {
    const q = matchingQuestion();
    const quiz = makeQuiz([q]);
    const shuffled = [
      { left: "Ribosome", right: "Protein synthesis" },
      { left: "Mitochondria", right: "Energy production" },
    ];
    const result = gradeAttempt(quiz, [matchingAnswer(q.id, shuffled)]);
    expect(result.graded[0].correct).toBe(true);

    const partial = gradeAttempt(quiz, [
      matchingAnswer(q.id, [
        { left: "Mitochondria", right: "Energy production" },
        { left: "Ribosome", right: "Wrong target" },
      ]),
    ]);
    expect(partial.graded[0].correct).toBe(false);
  });

  it("grades mc by index only", () => {
    const q = mcQuestion();
    const quiz = makeQuiz([q]);
    const wrong = gradeAttempt(quiz, [mcAnswer(q.id, 0)]);
    expect(wrong.graded[0].correct).toBe(false);
    const right = gradeAttempt(quiz, [mcAnswer(q.id, 1)]);
    expect(right.graded[0].correct).toBe(true);
  });

  it("treats an answer to an unknown question as zero", () => {
    const q = mcQuestion();
    const quiz = makeQuiz([q]);
    const result = gradeAttempt(quiz, [mcAnswer("does-not-exist", 0)]);
    expect(result.graded[0].correct).toBe(false);
    expect(result.score).toBe(0);
  });

  it("handles mixed question kinds in one attempt", () => {
    const q1 = mcQuestion();
    const q2 = tfQuestion();
    const q3 = fillQuestion();
    const q4 = matchingQuestion();
    const quiz = makeQuiz([q1, q2, q3, q4]);
    const result = gradeAttempt(quiz, [
      mcAnswer(q1.id, 1),
      tfAnswer(q2.id, false),
      fillAnswer(q3.id, "mitochondria"),
      matchingAnswer(q4.id, [
        { left: "Mitochondria", right: "Energy production" },
        { left: "Ribosome", right: "Protein synthesis" },
      ]),
    ]);
    expect(result.correctCount).toBe(3);
    expect(result.score).toBe(2 + 0 + 2 + 2);
  });

  it("accumulates points per question", () => {
    const q1 = mcQuestion({ points: 5 });
    const q2 = mcQuestion({ points: 1 });
    const quiz = makeQuiz([q1, q2]);
    const result = gradeAttempt(quiz, [mcAnswer(q1.id, 1), mcAnswer(q2.id, 2)]);
    expect(result.score).toBe(5);
    expect(result.totalPoints).toBe(6);
  });
});
