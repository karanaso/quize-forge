"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

const BALLOON_EMOJIS = ["🎈", "🎈", "🫧", "⭐", "💫", "🌈"];

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  opts: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    duration?: number;
    volume?: number;
    startDelay?: number;
  },
) {
  const {
    freq,
    endFreq,
    type = "triangle",
    duration = 0.15,
    volume = 0.22,
    startDelay = 0,
  } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + startDelay;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Playful rising "boing" when an answer is picked. */
function playSelectSound(muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
  playTone(ctx, { freq: 480, endFreq: 980, type: "triangle", duration: 0.13 });
}

/** Cheerful little arpeggio when the quiz is submitted. */
function playSubmitSound(muted: boolean) {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    playTone(ctx, {
      freq,
      type: "triangle",
      duration: 0.22,
      volume: 0.2,
      startDelay: i * 0.09,
    }),
  );
}

const TETRIS_TEMPO = 150; // BPM (eighth-note pulse)

// Korobeiniki (the Tetris theme), as [frequency, duration in eighths].
// A null frequency is a rest.
const TETRIS_MELODY: Array<[number | null, number]> = [
  [659.25, 1], [493.88, 1], [523.25, 1], [587.33, 1], [523.25, 1], [493.88, 1], [440.0, 1], [440.0, 1],
  [523.25, 1], [659.25, 1], [587.33, 1], [523.25, 1], [493.88, 1], [493.88, 1], [523.25, 1], [587.33, 1],
  [659.25, 1], [523.25, 1], [440.0, 1], [440.0, 1],
  [587.33, 1], [698.46, 1], [880.0, 1], [783.99, 1], [698.46, 1], [659.25, 1], [523.25, 1], [659.25, 1],
  [587.33, 1], [523.25, 1], [493.88, 1], [493.88, 1],
  [523.25, 1], [587.33, 1], [659.25, 1], [523.25, 1], [440.0, 1], [440.0, 1],
  [659.25, 1], [523.25, 1], [587.33, 1], [493.88, 1], [523.25, 1], [440.0, 1], [440.0, 2],
  [659.25, 1], [523.25, 1], [587.33, 1], [493.88, 1], [523.25, 1], [440.0, 1], [440.0, 2],
];

function Balloons({ count = 16 }: { count?: number }) {
  const balloons = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 6.7 + 2) % 100}%`,
        delay: `${(i * 0.83) % 16}s`,
        duration: `${10 + (i % 5) * 2.5}s`,
        emoji: BALLOON_EMOJIS[i % BALLOON_EMOJIS.length],
        size: `${1.4 + (i % 4) * 0.7}rem`,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {balloons.map((b, i) => (
        <span
          key={i}
          className="quiz-balloon"
          style={{
            left: b.left,
            fontSize: b.size,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}

function HappyBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="happy-backdrop"
      className="relative min-h-screen bg-gradient-to-br from-sky-100 via-indigo-50 to-rose-100"
    >
      <Balloons />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function StudentQuiz({ quiz }: { quiz: PublicQuiz }) {
  const { identity, setIdentity } = useStudentStore();

  return (
    <HappyBackdrop>
      {!identity ? (
        <IdentityForm
          onSubmit={(id) => {
            setIdentity(id);
          }}
        />
      ) : (
        <QuizRunner key={identity.studentName} quiz={quiz} identity={identity} />
      )}
    </HappyBackdrop>
  );
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
      className="quiz-pop-in mx-auto w-full max-w-md space-y-4 rounded-2xl border border-white/60 bg-white/85 p-6 shadow-lg shadow-indigo-100 backdrop-blur"
    >
      <div className="text-center">
        <div className="quiz-wiggle mb-1 text-4xl">🎈</div>
        <h2 className="text-lg font-semibold text-zinc-900">Before you start</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Tell us who you are — then let&apos;s have fun!
        </p>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">School name</span>
        <input
          required
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Class name</span>
        <input
          required
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Your name</span>
        <input
          required
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] hover:from-sky-600 hover:to-indigo-700 active:scale-95"
      >
        Let&apos;s go 🚀
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
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("quizforge:muted") === "1";
  });
  const startedAtRef = useRef<Date>(new Date());
  const submittedRef = useRef(false);
  const answersRef = useRef<Answer[]>(answers);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Looping Tetris-style background tune while the quiz runs.
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    let index = 0;
    const eighthMs = (60 / TETRIS_TEMPO / 2) * 1000;
    const timer = setInterval(() => {
      if (ctx.state !== "running") {
        void ctx.resume();
        return;
      }
      if (mutedRef.current) return; // paused while muted, resumes in sync
      const [freq, beats] = TETRIS_MELODY[index];
      if (freq) {
        playTone(ctx, {
          freq,
          type: "square",
          duration: (eighthMs * beats) / 1000 * 0.92,
          volume: 0.045,
        });
      }
      index = (index + 1) % TETRIS_MELODY.length;
    }, eighthMs);
    return () => clearInterval(timer);
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      window.localStorage.setItem("quizforge:muted", next ? "1" : "0");
      return next;
    });
  };

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    playSubmitSound(muted);
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
    playSelectSound(muted);
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
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8">
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-white/60 bg-white/90 px-4 py-3 shadow-lg shadow-indigo-100/60 backdrop-blur">
        <h1 className="min-w-0 truncate text-lg font-bold text-zinc-900">
          ✨ {quiz.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              secondsLeft <= 30
                ? "animate-pulse bg-rose-100 text-rose-600"
                : "bg-sky-100 text-sky-700"
            }`}
          >
            ⏱ {mins}:{secs}
          </div>
          <button
            onClick={toggleMute}
            title={muted ? "Unmute sounds" : "Mute sounds"}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm transition-colors hover:bg-zinc-50"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {orderedQuestions.map((q, idx) => (
        <div
          key={q.id}
          className="quiz-pop-in rounded-2xl border border-white/60 bg-white/85 p-4 shadow-lg shadow-indigo-100 backdrop-blur"
          style={{ animationDelay: `${Math.min(idx * 0.06, 0.4)}s` }}
        >
          <p className="font-medium text-zinc-900">
            {idx + 1}. {q.text}
            {q.points > 1 && (
              <span className="ml-2 text-xs font-normal text-zinc-700">
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
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${
                      selected?.selectedIndex === originalIdx
                        ? "border-sky-500 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-md"
                        : "border-zinc-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
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
                      className="h-4 w-4 accent-sky-500"
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
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all ${
                    answers.find((a) => a.questionId === q.id)?.value === val
                      ? "border-sky-500 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-md"
                      : "border-zinc-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers.find((a) => a.questionId === q.id)?.value === val}
                    onChange={() => setAnswer(q.id, { kind: "tf", value: val })}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {val ? "True ✅" : "False ❌"}
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
              placeholder="Type your answer… ✏️"
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
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
                      className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
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

      <div className="pt-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:scale-[1.01] hover:from-emerald-600 hover:to-teal-700 active:scale-95 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Finish & check my answers 🎉"}
        </button>
      </div>
    </div>
  );
}
