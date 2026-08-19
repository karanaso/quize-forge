"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/stores/editor";
import { useI18n } from "@/stores/locale";
import { youtubeUrlToEmbed } from "@/lib/youtube";
import { QuestionEditor } from "@/components/QuestionEditor";
import { QuizImage } from "@/components/QuizImage";
import type { PersistedQuestion } from "@/lib/schemas";

const KIND_LABEL_KEYS: Record<string, string> = {
  mc: "Multiple choice",
  tf: "True/False",
  fill: "Fill in the blank",
  matching: "Matching",
};

export function QuizEditor({
  quizId,
  initialTitle,
  initialQuestions,
  initialStatus,
  initialVideoUrl = "",
}: {
  quizId: string;
  initialTitle: string;
  initialQuestions: PersistedQuestion[];
  initialStatus: "draft" | "published";
  initialVideoUrl?: string;
}) {
  const router = useRouter();
  const store = useEditorStore();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.load(quizId, initialTitle, initialVideoUrl, initialQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  async function save() {
    const videoUrl = store.videoUrl.trim();
    if (videoUrl && youtubeUrlToEmbed(videoUrl) === null) {
      setError(t("Common", "Invalid YouTube URL"));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/quiz/${store.quizId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: store.title,
        videoUrl,
        questions: store.questions,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? t("Common", "Save failed"));
      return;
    }
    store.markSaved();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function publish() {
    await save();
    const res = await fetch(`/api/quiz/${store.quizId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  function addQuestion() {
    const q: PersistedQuestion = {
      id: crypto.randomUUID(),
      kind: "mc",
      text: t("QuizEditor", "New question"),
      options: ["", "", "", ""],
      correctIndex: 0,
      points: 1,
      explanation: "",
    };
    store.addQuestion(q);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={store.title}
          onChange={(e) => store.setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold"
        />
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            initialStatus === "published"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {initialStatus === "published"
            ? t("QuizEditor", "published")
            : t("QuizEditor", "draft")}
        </span>
        <button
          onClick={save}
          disabled={saving || !store.dirty}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saved
            ? t("QuizEditor", "Saved")
            : saving
              ? t("QuizEditor", "Saving…")
              : t("QuizEditor", "Save")}
        </button>
        <button
          onClick={publish}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {initialStatus === "published"
            ? t("QuizEditor", "Re-publish")
            : t("QuizEditor", "Publish")}
        </button>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">
          {t("QuizEditor", "YouTube video URL (optional)")}
        </span>
        <input
          value={store.videoUrl}
          onChange={(e) => store.setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {store.questions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-400">#{idx + 1}</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {t("Common", KIND_LABEL_KEYS[q.kind] ?? q.kind)}
                </span>
                <span className="text-xs text-zinc-400">
                  {t("QuizEditor", "{points} pt", { points: q.points })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => store.moveQuestion(q.id, -1)}
                  disabled={idx === 0}
                  className="rounded border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => store.moveQuestion(q.id, 1)}
                  disabled={idx === store.questions.length - 1}
                  className="rounded border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => store.deleteQuestion(q.id)}
                  className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                >
                  {t("QuizEditor", "Delete")}
                </button>
              </div>
            </div>
            {q.imageId && (
              <div className="mb-3">
                <QuizImage imageId={q.imageId} alt={q.imageCaption ?? t("Common", "figure")} />
              </div>
            )}
            <QuestionEditor
              question={q}
              onChange={(patch) => store.updateQuestion(q.id, patch)}
            />
          </div>
        ))}
      </div>

      <button
        onClick={addQuestion}
        className="w-full rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-700 hover:border-indigo-400 hover:text-indigo-600"
      >
        {t("QuizEditor", "+ Add question")}
      </button>
    </div>
  );
}
