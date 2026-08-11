import type { AttemptDoc } from "@/lib/models/attempt";

interface RawAttemptAnswer {
  questionId: string;
  kind: string;
  correct?: boolean;
  [key: string]: unknown;
}

export interface RawAttempt extends AttemptDoc {
  answers: RawAttemptAnswer[];
}

/**
 * Best attempt per student (school + class + name), then per-question
 * correct percentage across all students. `excludeKey` removes one student
 * so results show "other students" stats on the student-facing screen.
 */
export function computeQuestionStats(
  attempts: RawAttempt[],
  excludeKey?: string,
): Map<string, { correct: number; total: number; percent: number }> {
  const byStudent = new Map<string, RawAttempt>();
  for (const attempt of attempts) {
    const key = [
      attempt.school,
      attempt.className,
      attempt.studentName,
    ].join("::");
    const current = byStudent.get(key);
    if (!current || attempt.score > current.score) {
      byStudent.set(key, attempt);
    }
  }

  const totals = new Map<string, { correct: number; total: number }>();
  for (const [key, attempt] of byStudent) {
    if (excludeKey && key === excludeKey) continue;
    for (const id of new Set(attempt.answers.map((a) => a.questionId))) {
      const entry = totals.get(id) ?? { correct: 0, total: 0 };
      entry.total += 1;
      const raw = attempt.answers.find((a) => a.questionId === id);
      if (raw?.correct) entry.correct += 1;
      totals.set(id, entry);
    }
  }

  const result = new Map<
    string,
    { correct: number; total: number; percent: number }
  >();
  for (const [id, t] of totals) {
    result.set(id, {
      ...t,
      percent: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
    });
  }
  return result;
}

export function studentKey(
  school: string,
  className: string,
  studentName: string,
): string {
  return [school, className, studentName].join("::");
}
