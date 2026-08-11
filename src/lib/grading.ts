import type { Answer, PersistedQuestion, Quiz } from "@/lib/schemas";

export interface GradedQuestion {
  question: PersistedQuestion;
  correct: boolean;
  pointsEarned: number;
}

export interface GradedAttempt {
  score: number;
  totalPoints: number;
  correctCount: number;
  graded: GradedQuestion[];
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function gradeSingle(
  question: PersistedQuestion,
  answer: Answer,
): { correct: boolean } {
  switch (question.kind) {
    case "mc":
      return answer.kind === "mc" && answer.selectedIndex === question.correctIndex
        ? { correct: true }
        : { correct: false };
    case "tf":
      return answer.kind === "tf" && answer.value === question.correct
        ? { correct: true }
        : { correct: false };
    case "fill": {
      if (answer.kind !== "fill") return { correct: false };
      const normalized = normalize(answer.text);
      const accepted = question.acceptableAnswers.map(normalize);
      return accepted.includes(normalized) ? { correct: true } : { correct: false };
    }
    case "matching": {
      if (answer.kind !== "matching") return { correct: false };
      const rightByLeft = new Map(
        question.pairs.map((p) => [normalize(p.left), normalize(p.right)]),
      );
      const submitted = new Map(
        answer.pairings.map((p) => [normalize(p.left), normalize(p.right)]),
      );
      let matches = 0;
      for (const [left, right] of submitted) {
        if (rightByLeft.get(left) === right) matches++;
      }
      return { correct: matches === question.pairs.length };
    }
  }
}

/** Grade a full attempt. Answers not matching a question score zero. */
export function gradeAttempt(
  quiz: Quiz,
  answers: Answer[],
): GradedAttempt {
  const answerByQuestion = new Map(
    answers.map((a) => [a.questionId, a]),
  );

  const graded: GradedQuestion[] = quiz.questions.map((question) => {
    const answer = answerByQuestion.get(question.id);
    const result = answer
      ? gradeSingle(question, answer)
      : { correct: false };
    return {
      question,
      correct: result.correct,
      pointsEarned: result.correct ? question.points : 0,
    };
  });

  const score = graded.reduce((sum, g) => sum + g.pointsEarned, 0);
  const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  const correctCount = graded.filter((g) => g.correct).length;

  return { score, totalPoints, correctCount, graded };
}
