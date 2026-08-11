"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGeneratorStore, type DraftQuiz } from "@/stores/generator";
import { encryptWithOneTimeKey } from "@/lib/client-crypto";

export function CreateWizard() {
  const router = useRouter();
  const store = useGeneratorStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/pdf/upload", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setUploadError(data?.error ?? "Upload failed");
      return;
    }
    const data = await res.json();
    store.setPdf({ pdfId: data.pdfId, filename: data.filename, pageCount: data.pageCount });
    setStep(2);
  }

  async function generate() {
    if (!store.pdf || store.pageFrom == null || store.pageTo == null) return;
    if (!store.apiKey.trim()) {
      store.setError("Enter your OpenAI API key to generate.");
      return;
    }
    store.setBusy(true);
    store.setError(null);
    store.setProgress(null);
    setStep(3);

    try {
      const keyRes = await fetch("/api/crypto-key", { method: "POST" });
      const { requestId, key, iv } = await keyRes.json();
      const { ciphertext, iv: ivOut } = await encryptWithOneTimeKey(store.apiKey, key, iv);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encrypted: { requestId, ciphertext, iv: ivOut },
          payload: {
            pdfId: store.pdf.pdfId,
            pageFrom: store.pageFrom,
            pageTo: store.pageTo,
            questionCount: store.questionCount,
            difficulty: store.difficulty,
            timerMinutes: store.config.timerMinutes,
            shuffleQuestions: store.config.shuffleQuestions,
            shuffleOptions: store.config.shuffleOptions,
          },
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Generation failed");
      }

      await consumeStream(res.body, (event, data) => {
        if (event === "progress") {
          store.setProgress(data.message as string);
        } else if (event === "error") {
          store.setError(data.error as string);
          store.setBusy(false);
        } else if (event === "done") {
          store.setDraft(data.draft as DraftQuiz);
          store.setBusy(false);
          setStep(4);
        }
      });
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Generation failed");
      store.setBusy(false);
    }
  }

  async function save(status: "draft" | "published") {
    if (!store.draft || !store.pdf) return;
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: store.draft.title,
        pdfId: store.pdf.pdfId,
        sourceFilename: store.pdf.filename,
        pageFrom: store.pageFrom,
        pageTo: store.pageTo,
        difficulty: store.difficulty,
        language: store.draft.language,
        questions: store.draft.questions,
        config: store.config,
        status,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      store.setError(data?.error ?? "Save failed");
      return;
    }
    const { id } = await res.json();
    store.reset();
    if (status === "published") {
      router.push("/");
      router.refresh();
    } else {
      router.push(`/quiz/${id}/edit`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        {(["1. Upload", "2. Configure", "3. Generate", "4. Review"] as const).map(
          (label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  step === (i + 1) as 1 | 2 | 3 | 4
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {label}
              </span>
              {i < 3 && <span className="text-zinc-300">→</span>}
            </div>
          ),
        )}
      </div>

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="mx-auto block w-full max-w-md text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
          />
          {uploading && <p className="text-sm text-zinc-500">Uploading…</p>}
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <p className="text-xs text-zinc-400">
            PDF up to 20 pages, 50 MB. You&apos;ll pick a 1–10 page range next.
          </p>

          {store.pdf && (
            <div className="mx-auto max-w-md rounded-lg bg-zinc-50 p-4 text-left text-sm">
              <p className="font-medium text-zinc-800">{store.pdf.filename}</p>
              <p className="text-zinc-500">{store.pdf.pageCount} pages</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">From page</span>
                  <input
                    type="number"
                    min={1}
                    max={store.pdf.pageCount}
                    value={store.pageFrom ?? 1}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(store.pdf!.pageCount, Number(e.target.value) || 1));
                      store.setRange(v, store.pageTo ?? v);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">To page</span>
                  <input
                    type="number"
                    min={1}
                    max={store.pdf.pageCount}
                    value={store.pageTo ?? 1}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(store.pdf!.pageCount, Number(e.target.value) || 1));
                      store.setRange(store.pageFrom ?? v, v);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  />
                </label>
              </div>
              {store.pageFrom != null &&
                store.pageTo != null &&
                store.pageTo - store.pageFrom + 1 > 10 && (
                  <p className="mt-2 text-xs text-red-600">
                    Range too large — maximum 10 pages.
                  </p>
                )}
              <div className="mt-4 flex gap-2">
                <button
                  disabled={
                    store.pageFrom == null ||
                    store.pageTo == null ||
                    store.pageTo - store.pageFrom + 1 > 10 ||
                    store.pageFrom > store.pageTo
                  }
                  onClick={() => setStep(2)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  onClick={() => {
                    store.setPdf(null as unknown as never);
                  }}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
                >
                  Upload a different file
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Number of questions</span>
              <input
                type="number"
                min={1}
                max={50}
                value={store.questionCount}
                onChange={(e) => store.setQuestionCount(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Difficulty</span>
              <select
                value={store.difficulty}
                onChange={(e) => store.setDifficulty(e.target.value as never)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Timer (minutes)</span>
              <input
                type="number"
                min={1}
                max={180}
                value={store.config.timerMinutes}
                onChange={(e) =>
                  store.setConfig({ timerMinutes: Number(e.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">OpenAI API key</span>
              <input
                type="password"
                value={store.apiKey}
                onChange={(e) => store.setApiKey(e.target.value)}
                placeholder="sk-…"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-zinc-400">
                Encrypted and used only for this generation — never stored.
              </span>
            </label>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={store.config.shuffleQuestions}
                onChange={(e) => store.setConfig({ shuffleQuestions: e.target.checked })}
                className="h-4 w-4"
              />
              Shuffle questions
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={store.config.shuffleOptions}
                onChange={(e) => store.setConfig({ shuffleOptions: e.target.checked })}
                className="h-4 w-4"
              />
              Shuffle options
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={!store.apiKey.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Generate quiz
            </button>
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-zinc-600">
            {store.progress ?? "Preparing…"}
          </p>
          <p className="text-xs text-zinc-400">
            Reading up to 10 pages with images; this can take 30–60 seconds.
          </p>
        </div>
      )}

      {step === 4 && store.draft && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Quiz drafted successfully —{" "}
            <strong>{store.draft.questions.length} questions</strong> in{" "}
            <strong>{store.draft.language}</strong>.
          </div>
          {store.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {store.error}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => save("draft")}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Save draft & review questions
            </button>
            <button
              onClick={() => save("published")}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Review later — publish now
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Questions were generated from the full page range. Use the editor to fix
            answer keys, reorder, or remove questions before publishing.
          </p>
        </div>
      )}
      {step === 4 && !store.draft && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {store.error ?? "Something went wrong during generation."}
        </div>
      )}
      {step === 4 && !store.draft && (
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      )}
    </div>
  );
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1] ?? "message";
      const dataRaw = part.match(/^data: (.+)$/m)?.[1];
      if (!dataRaw) continue;
      try {
        onEvent(event, JSON.parse(dataRaw));
      } catch {
        // ignore malformed frames
      }
    }
  }
}
