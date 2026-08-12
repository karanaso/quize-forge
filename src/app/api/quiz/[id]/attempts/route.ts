import { NextResponse } from "next/server";
import { Quiz } from "@/lib/models/quiz";
import { Attempt } from "@/lib/models/attempt";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { computeQuestionStats, type RawAttempt } from "@/lib/stats";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

interface StoredAnswer {
  questionId: string;
  kind: string;
  selectedIndex?: number;
  value?: boolean;
  text?: string;
  pairings?: { left: string; right: string }[];
  correct?: boolean;
}

interface QuizQuestion {
  id: string;
  kind: string;
  text?: string;
  points?: number;
  options?: string[];
  correctIndex?: number;
  correct?: boolean;
  acceptableAnswers?: string[];
  pairs?: { left: string; right: string }[];
}

function correctAnswerText(q: QuizQuestion | undefined): string {
  if (!q) return "—";
  switch (q.kind) {
    case "mc":
      return q.options?.[q.correctIndex ?? -1] ?? "—";
    case "tf":
      return q.correct ? "True" : "False";
    case "fill":
      return q.acceptableAnswers?.join(" / ") ?? "—";
    case "matching":
      return q.pairs?.map((p) => `${p.left} → ${p.right}`).join("; ") ?? "—";
    default:
      return "—";
  }
}

function studentAnswerText(ans: StoredAnswer, q: QuizQuestion | undefined): string {
  switch (ans.kind) {
    case "mc":
      return typeof ans.selectedIndex === "number"
        ? q?.options?.[ans.selectedIndex] ?? `Option ${ans.selectedIndex + 1}`
        : "No answer";
    case "tf":
      return ans.value === true ? "True" : ans.value === false ? "False" : "No answer";
    case "fill":
      return ans.text?.trim() ? ans.text : "No answer";
    case "matching":
      return ans.pairings?.length
        ? ans.pairings.map((p) => `${p.left} → ${p.right}`).join("; ")
        : "No answer";
    default:
      return "No answer";
  }
}

function buildResponses(
  questions: QuizQuestion[],
  answers: StoredAnswer[],
): Array<{
  questionId: string;
  text: string;
  kind: string;
  points: number;
  correct: boolean;
  studentAnswer: string;
  correctAnswer: string;
}> {
  const qById = new Map(questions.map((q) => [q.id, q]));
  return answers.map((ans) => {
    const q = qById.get(ans.questionId);
    return {
      questionId: ans.questionId,
      text: q?.text ?? "Unknown question",
      kind: q?.kind ?? ans.kind,
      points: q?.points ?? 1,
      correct: ans.correct ?? false,
      studentAnswer: studentAnswerText(ans, q),
      correctAnswer: correctAnswerText(q),
    };
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  await requireTeacher();
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await dbConnect();
  const quiz = await Quiz.findById(id).lean();
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attempts = (await Attempt.find({ quizId: quiz._id })
    .sort({ score: -1, durationSec: 1 })
    .lean()) as unknown as RawAttempt[];

  const bestByStudent = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    const key = [a.school, a.className, a.studentName].join("::");
    const cur = bestByStudent.get(key);
    if (!cur || a.score > cur.score) bestByStudent.set(key, a);
  }

  const students = [...bestByStudent.values()].map((a) => ({
    school: a.school,
    className: a.className,
    studentName: a.studentName,
    score: a.score,
    totalPoints: a.totalPoints,
    correctCount: a.correctCount,
    durationSec: a.durationSec,
    attempts: attempts.filter(
      (x) =>
        x.school === a.school &&
        x.className === a.className &&
        x.studentName === a.studentName,
    ).length,
    responses: buildResponses(
      quiz.questions as unknown as QuizQuestion[],
      a.answers as unknown as StoredAnswer[],
    ),
  }));

  const allStats = computeQuestionStats(attempts);

  return NextResponse.json({
    totalAttempts: attempts.length,
    totalStudents: students.length,
    averageScore:
      students.length > 0
        ? Math.round(
            (students.reduce((s, x) => s + x.score, 0) / students.length) * 10,
          ) / 10
        : 0,
    students,
    perQuestion: Object.fromEntries(allStats),
    questionCount: quiz.questions.length,
  });
}
