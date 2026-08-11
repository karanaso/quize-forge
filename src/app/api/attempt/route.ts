import { NextResponse } from "next/server";
import { Quiz } from "@/lib/models/quiz";
import { Attempt } from "@/lib/models/attempt";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { gradeAttempt } from "@/lib/grading";
import { computeQuestionStats, studentKey } from "@/lib/stats";
import { attemptSchema } from "@/lib/schemas";
import type { QuizDoc } from "@/lib/models/quiz";
import type { RawAttempt } from "@/lib/stats";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = attemptSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid attempt" },
      { status: 400 },
    );
  }
  const { quizId, identity, answers, startedAt } = body.data;

  if (!isValidObjectId(quizId)) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  await dbConnect();
  const quiz = (await Quiz.findOne({
    _id: quizId,
    status: "published",
  }).lean()) as unknown as QuizDoc;
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found or unpublished" }, { status: 404 });
  }

  const quizView = {
    ...quiz,
    _id: quiz._id.toString(),
  } as unknown as import("@/lib/schemas").Quiz;

  const result = gradeAttempt(quizView, answers);

  const doc = await Attempt.create({
    quizId: quiz._id,
    school: identity.school,
    className: identity.className,
    studentName: identity.studentName,
    answers: answers.map((a, i) => ({
      ...a,
      correct: result.graded[i]?.correct ?? false,
    })),
    score: result.score,
    totalPoints: result.totalPoints,
    correctCount: result.correctCount,
    durationSec: Math.max(
      0,
      Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
    ),
    startedAt: new Date(startedAt),
  });

  const attempts = (await Attempt.find({ quizId: quiz._id }).lean()) as unknown as RawAttempt[];
  const excludeKey = studentKey(
    identity.school,
    identity.className,
    identity.studentName,
  );
  const stats = computeQuestionStats(attempts, excludeKey);

  const graded = result.graded.map((g) => ({
    questionId: g.question.id,
    kind: g.question.kind,
    text: g.question.text,
    points: g.question.points,
    pointsEarned: g.pointsEarned,
    correct: g.correct,
    correctAnswer:
      g.question.kind === "mc"
        ? g.question.options[g.question.correctIndex]
        : g.question.kind === "tf"
          ? g.question.correct
          : g.question.kind === "fill"
            ? g.question.acceptableAnswers
            : g.question.pairs.map((p) => ({ left: p.left, right: p.right })),
    explanation: g.question.explanation,
    imageId: g.question.imageId,
  }));

  return NextResponse.json({
    attemptId: doc._id.toString(),
    score: result.score,
    totalPoints: result.totalPoints,
    correctCount: result.correctCount,
    totalQuestions: quiz.questions.length,
    graded,
    stats: Object.fromEntries(stats),
  });
}
