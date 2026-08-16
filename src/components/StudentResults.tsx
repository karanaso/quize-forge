"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudentStore } from "@/stores/student";
import { QuizImage } from "@/components/QuizImage";

interface GradedAnswer {
  questionId: string;
  kind: string;
  text: string;
  points: number;
  pointsEarned: number;
  correct: boolean;
  correctAnswer: unknown;
  explanation: string;
  imageId?: string;
}

interface AttemptResult {
  attemptId: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
  graded: GradedAnswer[];
  stats: Record<string, { correct: number; total: number; percent: number }>;
}

function answerLabel(g: GradedAnswer): string {
  switch (g.kind) {
    case "mc":
      return String(g.correctAnswer);
    case "tf":
      return g.correctAnswer ? "True" : "False";
    case "fill":
      return Array.isArray(g.correctAnswer)
        ? g.correctAnswer.join(" / ")
        : String(g.correctAnswer);
    case "matching":
      return Array.isArray(g.correctAnswer)
        ? g.correctAnswer
            .map((p: { left: string; right: string }) => `${p.left} → ${p.right}`)
            .join(" · ")
        : "";
    default:
      return "";
  }
}

export function StudentResults({
  quizId,
  quizTitle,
}: {
  quizId: string;
  quizTitle: string;
}) {
  const { identity } = useStudentStore();
  const [result] = useState<AttemptResult | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(`quizforge:result:${quizId}`);
    return raw ? (JSON.parse(raw) as AttemptResult) : null;
  });
  const [liveStats, setLiveStats] = useState<Record<string, { correct: number; total: number; percent: number }> | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    if (identity) {
      fetch(
        `/api/quiz/${quizId}/stats?school=${encodeURIComponent(
          identity.school,
        )}&class=${encodeURIComponent(identity.className)}&student=${encodeURIComponent(
          identity.studentName,
        )}`,
      )
        .then((r) => r.json())
        .then((data) => setLiveStats(data.stats))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <p className="text-zinc-700">No attempt found for this quiz.</p>
        <Link href={`/q/${quizId}`} className="text-sm text-indigo-600 hover:underline">
          Take the quiz
        </Link>
      </div>
    );
  }

  const percent = Math.round((result.score / result.totalPoints) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <h1 className="text-xl font-bold text-zinc-900">{quizTitle}</h1>
        <p className="mt-1 text-sm text-zinc-700">
          {result.correctCount} of {result.totalQuestions} correct
        </p>
        <p className="mt-2 text-4xl font-extrabold text-indigo-600">
          {result.score} / {result.totalPoints}
          <span className="ml-2 text-lg font-medium text-zinc-400">({percent}%)</span>
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href={`/q/${quizId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Retake quiz
          </Link>
          <Link
            href={`/q/${quizId}`}
            onClick={() => sessionStorage.removeItem(`quizforge:result:${quizId}`)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {result.graded.map((g, i) => {
          const stat = liveStats?.[g.questionId] ?? result.stats[g.questionId];
          return (
            <div
              key={g.questionId}
              className={`rounded-xl border p-4 ${
                g.correct ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-zinc-900">
                  {i + 1}. {g.text}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    g.correct
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {g.correct ? `+${g.pointsEarned}` : `0/${g.points}`}
                </span>
              </div>
              <QuizImage imageId={g.imageId} alt="figure" className="mt-2" />

              {!g.correct && (
                <p className="mt-2 text-sm text-zinc-700">
                  <span className="font-medium">Correct answer: </span>
                  {answerLabel(g)}
                </p>
              )}
              {g.explanation && (
                <p className="mt-1 text-sm text-zinc-700">{g.explanation}</p>
              )}
              {stat && stat.total > 0 && (
                <p className="mt-2 text-xs text-zinc-700">
                  {stat.percent}% of other students answered correctly (
                  {stat.correct}/{stat.total})
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
