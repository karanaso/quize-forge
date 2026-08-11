"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentStore } from "@/stores/student";
import { QuizImage } from "@/components/QuizImage";
import type { StudentIdentity } from "@/lib/schemas";

export interface PublicQuestion {
  id: string;
  points: number;
  imageId?: string;
  imageCaption?: string;
  kind: "mc" | "tf" | "fill" | "matching";
  text: string;
  options?: string[];
  leftItems?: string[];
  rightItems?: string[];
}

export interface PublicQuiz {
  id: string;
  title: string;
  questions: PublicQuestion[];
  config: {
    timerMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
}

type Answer = {
  questionId: string;
  kind: PublicQuestion["kind"];
  selectedIndex?: number;
  value?: boolean;
  text?: string;
  pairings?: { left: string; right: string }[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function StudentQuiz({ quiz }: { quiz: PublicQuiz }) {
  const { identity, setIdentity } = useStudentStore();

  if (!identity) {
    return (
      <IdentityForm
        onSubmit={(id) => {
          setIdentity(id);
        }}
      />
    );
  }
  return <QuizRunner key={identity.studentName} quiz={quiz} identity={identity} />;
}

function IdentityForm({ onSubmit }: { onSubmit: (id: StudentIdentity) => void }) {
  const [school, setSchool] = useState("");
  const [className, setClassName] = useState("");
  const [studentName, setStudentName] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ school, className, studentName });
      }}
      className="mx-auto w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-zinc-900">Before you start</h2>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">School name</span>
        <input
          required
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Class name</span>
        <input
          required
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Your name</span>
        <input
          required
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Start quiz
      </button>
    </form>
  );
}

function QuizRunner({
  quiz,
  identity,
}: {
  quiz: PublicQuiz;
  identity: StudentIdentity;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(quiz.config.timerMinutes * 60);
  const startedAtRef = useRef<Date>(new Date());
  const submittedRef = useRef(false);
  const answersRef = useRef<Answer[]>(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const res = await fetch("/api/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: quiz.id,
        identity,
        answers: answersRef.current,
        startedAt: startedAtRef.current.toISOString(),
      }),
    });
    if (!res.ok) {
      setSubmitting(false);
      alert("Could not submit — please try again.");
      submittedRef.current = false;
      return;
    }
    const result = await res.json();
    sessionStorage.setItem(`quizforge:result:${quiz.id}`, JSON.stringify(result));
    router.push(`/q/${quiz.id}/results`);
  };

  const orderedQuestions = useMemo(() => {
    const qs = [...quiz.questions];
    return quiz.config.shuffleQuestions ? shuffle(qs) : qs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id]);

  // Per-question display permutations (display index -> original index)
  const permutations = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!quiz.config.shuffleOptions) return map;
    for (const q of orderedQuestions) {
      if (q.kind === "mc" && q.options) {
        map.set(q.id, shuffle(q.options.map((_, i) => i)));
      }
      if (q.kind === "matching" && q.rightItems) {
        map.set(q.id, shuffle(q.rightItems.map((_, i) => i)));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedQuestions]);

  const setAnswer = (questionId: string, patch: Partial<Answer>) => {
    setAnswers((prev) => {
      const idx = prev.findIndex((a) => a.questionId === questionId);
      if (idx < 0) return [...prev, { questionId, kind: "", ...patch } as Answer];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          void submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-zinc-900">{quiz.title}</h1>
        <div className="text-sm font-semibold text-zinc-600">
          {mins}:{secs}
        </div>
      </div>

      {orderedQuestions.map((q, idx) => (
        <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="font-medium text-zinc-900">
            {idx + 1}. {q.text}
            {q.points > 1 && (
              <span className="ml-2 text-xs font-normal text-zinc-400">
                {q.points} pts
              </span>
            )}
          </p>
          <QuizImage imageId={q.imageId} alt={q.imageCaption ?? "figure"} className="my-3" />

          {q.kind === "mc" && q.options && (
            <div className="mt-3 space-y-2">
              {q.options.map((opt, displayIdx) => {
                const originalIdx = (permutations.get(q.id) ?? [])[displayIdx];
                const selected = answers.find((a) => a.questionId === q.id);
                return (
                  <label
                    key={displayIdx}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                      selected?.selectedIndex === originalIdx
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected?.selectedIndex === originalIdx}
                      onChange={() =>
                        setAnswer(q.id, {
                          kind: "mc",
                          selectedIndex: originalIdx,
                        })
                      }
                      className="h-4 w-4"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}

          {q.kind === "tf" && (
            <div className="mt-3 flex gap-3">
              {[true, false].map((val) => (
                <label
                  key={String(val)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                    answers.find((a) => a.questionId === q.id)?.value === val
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers.find((a) => a.questionId === q.id)?.value === val}
                    onChange={() => setAnswer(q.id, { kind: "tf", value: val })}
                    className="h-4 w-4"
                  />
                  {val ? "True" : "False"}
                </label>
              ))}
            </div>
          )}

          {q.kind === "fill" && (
            <input
              value={
                (answers.find((a) => a.questionId === q.id)?.text as string) ?? ""
              }
              onChange={(e) => setAnswer(q.id, { kind: "fill", text: e.target.value })}
              placeholder="Type your answer…"
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          )}

          {q.kind === "matching" && q.leftItems && q.rightItems && (
            <div className="mt-3 space-y-2">
              {q.leftItems.map((left) => {
                const rightOptions = permutations.get(q.id) ?? [];
                const current = answers
                  .find((a) => a.questionId === q.id)
                  ?.pairings?.find((p) => p.left === left);
                return (
                  <div key={left} className="flex items-center gap-2 text-sm">
                    <span className="w-1/2 truncate font-medium">{left}</span>
                    <select
                      value={current?.right ?? ""}
                      onChange={(e) => {
                        const pairings =
                          answers.find((a) => a.questionId === q.id)?.pairings ??
                          [];
                        const filtered = pairings.filter((p) => p.left !== left);
                        setAnswer(q.id, {
                          kind: "matching",
                          pairings: [...filtered, { left, right: e.target.value }],
                        });
                      }}
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
                    >
                      <option value="">— select —</option>
                      {rightOptions.map((rightIdx) => (
                        <option
                          key={rightIdx}
                          value={q.rightItems![rightIdx]}
                        >
                          {q.rightItems![rightIdx]}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit quiz"}
      </button>
    </div>
  );
}
