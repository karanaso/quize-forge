import { NextResponse } from "next/server";
import { Quiz } from "@/lib/models/quiz";
import { Attempt } from "@/lib/models/attempt";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { computeQuestionStats, type RawAttempt } from "@/lib/stats";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

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
