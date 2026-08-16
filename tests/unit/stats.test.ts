import { describe, expect, it } from "vitest";
import { computeQuestionStats, studentKey } from "@/lib/stats";
import type { RawAttempt } from "@/lib/stats";

function attempt(
  overrides: Partial<RawAttempt> & {
    school: string;
    className: string;
    studentName: string;
    score: number;
    answers: RawAttempt["answers"];
  },
): RawAttempt {
  return {
    _id: overrides.school + overrides.studentName as unknown as RawAttempt["_id"],
    quizId: "quiz" as unknown as RawAttempt["quizId"],
    school: overrides.school,
    className: overrides.className,
    studentName: overrides.studentName,
    answers: overrides.answers,
    score: overrides.score,
    totalPoints: 10,
    correctCount: 0,
    durationSec: 60,
    startedAt: new Date(),
    createdAt: new Date(),
  };
}

const a = (questionId: string, correct: boolean) => ({
  questionId,
  kind: "mc",
  correct,
});

describe("computeQuestionStats", () => {
  it("returns per-question percent using best attempt per student", () => {
    const attempts = [
      attempt({
        school: "Springfield",
        className: "9A",
        studentName: "Lisa",
        score: 1,
        answers: [a("q1", true), a("q2", false)],
      }),
      attempt({
        school: "Springfield",
        className: "9A",
        studentName: "Lisa",
        score: 2,
        answers: [a("q1", true), a("q2", true)],
      }),
      attempt({
        school: "Springfield",
        className: "9A",
        studentName: "Bart",
        score: 2,
        answers: [a("q1", true), a("q2", true)],
      }),
    ];

    const stats = computeQuestionStats(attempts);
    expect(stats.get("q1")).toEqual({ correct: 2, total: 2, percent: 100 });
    expect(stats.get("q2")).toEqual({ correct: 2, total: 2, percent: 100 });
  });

  it("excludes the given student key from totals", () => {
    const attempts = [
      attempt({
        school: "S",
        className: "C",
        studentName: "Lisa",
        score: 2,
        answers: [a("q1", true)],
      }),
      attempt({
        school: "S",
        className: "C",
        studentName: "Bart",
        score: 1,
        answers: [a("q1", false)],
      }),
    ];
    const exclude = studentKey("S", "C", "Lisa");
    const stats = computeQuestionStats(attempts, exclude);
    expect(stats.get("q1")).toEqual({ correct: 0, total: 1, percent: 0 });
  });

  it("ignores answers for questions not present", () => {
    const attempts = [
      attempt({
        school: "S",
        className: "C",
        studentName: "Lisa",
        score: 1,
        answers: [a("q1", true)],
      }),
    ];
    const stats = computeQuestionStats(attempts);
    expect(stats.has("nope")).toBe(false);
    expect(stats.get("q1")!.total).toBe(1);
  });

  it("treats duplicate question ids within one attempt once", () => {
    const attempts = [
      attempt({
        school: "S",
        className: "C",
        studentName: "Lisa",
        score: 1,
        answers: [a("q1", true), a("q1", true)],
      }),
    ];
    const stats = computeQuestionStats(attempts);
    expect(stats.get("q1")).toEqual({ correct: 1, total: 1, percent: 100 });
  });

  it("returns an empty map for no attempts", () => {
    expect(computeQuestionStats([]).size).toBe(0);
  });

  it("rounds percent to nearest integer", () => {
    const attempts = [
      attempt({ school: "S", className: "C", studentName: "A", score: 1, answers: [a("q1", true)] }),
      attempt({ school: "S", className: "C", studentName: "B", score: 1, answers: [a("q1", false)] }),
      attempt({ school: "S", className: "C", studentName: "D", score: 1, answers: [a("q1", false)] }),
    ];
    const stats = computeQuestionStats(attempts);
    expect(stats.get("q1")!.percent).toBe(33);
  });
});

describe("studentKey", () => {
  it("joins school, class and name", () => {
    expect(studentKey("S", "C", "N")).toBe("S::C::N");
  });
});
