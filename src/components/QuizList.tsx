"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QuizSummary {
  id: string;
  title: string;
  status: "draft" | "published";
  sourceFilename: string | null;
  pageFrom: number;
  pageTo: number;
  difficulty: string;
  language: string;
  questionCount: number;
  timerMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export function QuizList() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/quiz");
    if (!res.ok) {
      setError("Failed to load quizzes");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setQuizzes(data.quizzes);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function toggleStatus(id: string) {
    const quiz = quizzes.find((q) => q.id === id);
    if (!quiz) return;
    const res = await fetch(`/api/quiz/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: quiz.status === "published" ? "draft" : "published",
      }),
    });
    if (res.ok) await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this quiz permanently?")) return;
    const res = await fetch(`/api/quiz/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/q/${id}`);
  }

  if (loading) return <p className="py-10 text-center text-zinc-500">Loading…</p>;
  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;

  if (quizzes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-zinc-600">
          No quizzes yet. Upload a PDF and let the AI build one for you.
        </p>
        <Link
          href="/create"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Create your first quiz
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quizzes.map((q) => (
        <div
          key={q.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-zinc-900">{q.title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  q.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {q.status}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {q.sourceFilename ?? "Imported PDF"} · pages {q.pageFrom}–{q.pageTo} ·{" "}
              {q.questionCount} questions · {q.timerMinutes} min · {q.difficulty} ·{" "}
              {q.language}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/quiz/${q.id}/edit`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              Edit
            </Link>
            <Link
              href={`/quiz/${q.id}/results`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              Results
            </Link>
            <Link
              href={`/quiz/${q.id}/print`}
              target="_blank"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              Print
            </Link>
            <button
              onClick={() => copyLink(q.id)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              Copy link
            </button>
            <button
              onClick={() => toggleStatus(q.id)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
            >
              {q.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <button
              onClick={() => remove(q.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
