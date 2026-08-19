import { NextResponse } from "next/server";
import { Quiz } from "@/lib/models/quiz";
import { Attempt } from "@/lib/models/attempt";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { serverT, type Locale } from "@/lib/i18n";
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

function correctAnswerText(q: QuizQuestion | undefined, locale: Locale): string {
  if (!q) return "—";
  switch (q.kind) {
    case "mc":
      return q.options?.[q.correctIndex ?? -1] ?? "—";
    case "tf":
      return q.correct
        ? serverT(locale, "Common", "True")
        : serverT(locale, "Common", "False");
    case "fill":
      return q.acceptableAnswers?.join(" / ") ?? "—";
    case "matching":
      return q.pairs?.map((p) => `${p.left} → ${p.right}`).join("; ") ?? "—";
    default:
      return "—";
  }
}

function studentAnswerText(
  ans: StoredAnswer,
  q: QuizQuestion | undefined,
  locale: Locale,
): string {
  const noAnswer = serverT(locale, "Common", "No answer");
  switch (ans.kind) {
    case "mc":
      return typeof ans.selectedIndex === "number"
        ? q?.options?.[ans.selectedIndex] ??
            serverT(locale, "Common", "Option {index}", { index: ans.selectedIndex + 1 })
        : noAnswer;
    case "tf":
      return ans.value === true
        ? serverT(locale, "Common", "True")
        : ans.value === false
          ? serverT(locale, "Common", "False")
          : noAnswer;
    case "fill":
      return ans.text?.trim() ? ans.text : noAnswer;
    case "matching":
      return ans.pairings?.length
        ? ans.pairings.map((p) => `${p.left} → ${p.right}`).join("; ")
        : noAnswer;
    default:
      return noAnswer;
  }
}

function buildResponses(
  questions: QuizQuestion[],
  answers: StoredAnswer[],
  locale: Locale,
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
      text: q?.text ?? serverT(locale, "Common", "Unknown question"),
      kind: q?.kind ?? ans.kind,
      points: q?.points ?? 1,
      correct: ans.correct ?? false,
      studentAnswer: studentAnswerText(ans, q, locale),
      correctAnswer: correctAnswerText(q, locale),
    };
  });
}

export async function GET(req: Request, ctx: Ctx) {
  const session = await requireTeacher();
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const locale: Locale =
    (new URL(req.url).searchParams.get("lang") as Locale | null) ?? "en";

  await dbConnect();
  const quiz = await Quiz.findOne({ _id: id, ownerId: session.userId }).lean();
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
      locale,
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
