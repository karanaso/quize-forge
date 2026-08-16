"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/stores/editor";
import { QuestionEditor } from "@/components/QuestionEditor";
import { QuizImage } from "@/components/QuizImage";
import type { PersistedQuestion } from "@/lib/schemas";

const KIND_LABEL: Record<string, string> = {
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
}: {
  quizId: string;
  initialTitle: string;
  initialQuestions: PersistedQuestion[];
  initialStatus: "draft" | "published";
}) {
  const router = useRouter();
  const store = useEditorStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.load(quizId, initialTitle, initialQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/quiz/${store.quizId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: store.title,
        questions: store.questions,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Save failed");
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
      text: "New question",
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
          {initialStatus}
        </span>
        <button
          onClick={save}
          disabled={saving || !store.dirty}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={publish}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {initialStatus === "published" ? "Re-publish" : "Publish"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {store.questions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-400">#{idx + 1}</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {KIND_LABEL[q.kind]}
                </span>
                <span className="text-xs text-zinc-400">{q.points} pt</span>
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
                  Delete
                </button>
              </div>
            </div>
            {q.imageId && (
              <div className="mb-3">
                <QuizImage imageId={q.imageId} alt={q.imageCaption ?? "figure"} />
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
        + Add question
      </button>
    </div>
  );
}
