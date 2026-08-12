"use client";

import { useEffect, useState } from "react";

interface ResponseDetail {
  questionId: string;
  text: string;
  kind: string;
  points: number;
  correct: boolean;
  studentAnswer: string;
  correctAnswer: string;
}

interface StudentRow {
  school: string;
  className: string;
  studentName: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  durationSec: number;
  attempts: number;
  responses: ResponseDetail[];
}

interface AttemptsData {
  totalAttempts: number;
  totalStudents: number;
  averageScore: number;
  students: StudentRow[];
  perQuestion: Record<string, { correct: number; total: number; percent: number }>;
  questionCount: number;
}

export function TeacherResults({
  quizId,
  questionCount,
}: {
  quizId: string;
  questionCount: number;
}) {
  const [data, setData] = useState<AttemptsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<StudentRow | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/${quizId}/attempts`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Failed to load results"));
  }, [quizId]);

  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!data) return <p className="py-10 text-center text-zinc-700">Loading…</p>;

  if (data.totalStudents === 0) {
    return (
      <p className="py-10 text-center text-zinc-700">
        No attempts yet. Share the student link to start collecting results.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-700">Students</p>
          <p className="mt-1 text-2xl font-bold">{data.totalStudents}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-700">Total attempts</p>
          <p className="mt-1 text-2xl font-bold">{data.totalAttempts}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-700">Average score (best)</p>
          <p className="mt-1 text-2xl font-bold">
            {data.averageScore} / {questionCount * 1}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-700">
              <th className="px-4 py-2">School</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2 text-right">Best score</th>
              <th className="px-4 py-2 text-right">Correct</th>
              <th className="px-4 py-2 text-right">Attempts</th>
              <th className="px-4 py-2 text-right">Responses</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={`${s.school}::${s.className}::${s.studentName}`} className="border-b border-zinc-100">
                <td className="px-4 py-2">{s.school}</td>
                <td className="px-4 py-2">{s.className}</td>
                <td className="px-4 py-2 font-medium">{s.studentName}</td>
                <td className="px-4 py-2 text-right">
                  {s.score} / {s.totalPoints}
                </td>
                <td className="px-4 py-2 text-right">{s.correctCount}</td>
                <td className="px-4 py-2 text-right">{s.attempts}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setViewing(s)}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    View responses
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <ResponseModal
          student={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Per-question difficulty</h2>
        <div className="space-y-2">
          {Object.entries(data.perQuestion)
            .sort((a, b) => a[1].percent - b[1].percent)
            .map(([qid, stat], i) => (
              <div key={qid} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                <span className="w-6 text-zinc-400">Q{i + 1}</span>
                <div className="h-2 flex-1 rounded-full bg-zinc-100">
                  <div
                    className={`h-2 rounded-full ${
                      stat.percent >= 70
                        ? "bg-emerald-500"
                        : stat.percent >= 40
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${stat.percent}%` }}
                  />
                </div>
                <span className="w-24 text-right text-xs text-zinc-700">
                  {stat.percent}% ({stat.correct}/{stat.total})
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  mc: "Multiple choice",
  tf: "True / False",
  fill: "Fill in the blank",
  matching: "Matching",
};

function ResponseModal({
  student,
  onClose,
}: {
  student: StudentRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{student.studentName}</h3>
            <p className="text-sm text-zinc-700">
              {student.school} · {student.className} · {student.score} /{" "}
              {student.totalPoints} points
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          {student.responses.map((r, i) => (
            <div
              key={r.questionId}
              className={`rounded-xl border p-3 text-sm ${
                r.correct
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-zinc-900">
                  Q{i + 1}. {r.text}
                </p>
                <span className="shrink-0 text-xs text-zinc-700">
                  {r.correct ? "✓" : "✗"} {r.points} pts
                </span>
              </div>
              <p className="mt-1 text-zinc-700">
                <span className="text-xs uppercase text-zinc-500">
                  {KIND_LABELS[r.kind] ?? r.kind}
                </span>
              </p>
              <p className="mt-2">
                <span className="font-semibold text-zinc-800">Your answer: </span>
                <span className={r.correct ? "text-emerald-700" : "text-red-700"}>
                  {r.studentAnswer}
                </span>
              </p>
              {!r.correct && (
                <p className="mt-1">
                  <span className="font-semibold text-zinc-800">Correct: </span>
                  <span className="text-emerald-700">{r.correctAnswer}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
