"use client";

import { useEffect, useState } from "react";

interface StudentRow {
  school: string;
  className: string;
  studentName: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  durationSec: number;
  attempts: number;
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

  useEffect(() => {
    fetch(`/api/quiz/${quizId}/attempts`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Failed to load results"));
  }, [quizId]);

  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!data) return <p className="py-10 text-center text-zinc-500">Loading…</p>;

  if (data.totalStudents === 0) {
    return (
      <p className="py-10 text-center text-zinc-500">
        No attempts yet. Share the student link to start collecting results.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Students</p>
          <p className="mt-1 text-2xl font-bold">{data.totalStudents}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Total attempts</p>
          <p className="mt-1 text-2xl font-bold">{data.totalAttempts}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Average score (best)</p>
          <p className="mt-1 text-2xl font-bold">
            {data.averageScore} / {questionCount * 1}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
              <th className="px-4 py-2">School</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2 text-right">Best score</th>
              <th className="px-4 py-2 text-right">Correct</th>
              <th className="px-4 py-2 text-right">Attempts</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                <span className="w-24 text-right text-xs text-zinc-500">
                  {stat.percent}% ({stat.correct}/{stat.total})
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
