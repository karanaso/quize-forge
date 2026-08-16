import Image from "next/image";
import { requireTeacher } from "@/lib/auth";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { Quiz } from "@/lib/models/quiz";
import { PrintButton } from "@/components/PrintButton";
import { renderT, getServerLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PersistedQuestion } from "@/lib/schemas";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function answerFor(q: PersistedQuestion, locale: Locale): string {
  switch (q.kind) {
    case "mc":
      return `${String.fromCharCode(65 + q.correctIndex)}. ${q.options[q.correctIndex]}`;
    case "tf":
      return q.correct
        ? t(locale, "Print", "True")
        : t(locale, "Print", "False");
    case "fill":
      return q.acceptableAnswers.join(" / ");
    case "matching":
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join("; ");
  }
}

export default async function AnswersPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await dbConnect();
  const doc = await Quiz.findById(id).lean();
  if (!doc) notFound();

  const questions = (doc.questions ?? []) as unknown as PersistedQuestion[];
  const locale = await getServerLocale();
  const answerLabel = await renderT("Print", "Answer:");
  const explanationLabel = await renderT("Print", "Explanation:");

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-8 flex items-start justify-between print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">
          {await renderT("Print", "Answer key")}
        </h1>
        <div className="flex gap-2">
          <a
            href={`/quiz/${id}/print`}
            target="_blank"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            {await renderT("Print", "Quiz")}
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-2xl font-bold">
          {await renderT("Print", "{title} — Answer Key", { title: doc.title })}
        </h1>
        <p className="text-sm text-zinc-700">
          {await renderT("Print", "{count} questions · {minutes} minutes", {
            count: doc.questions.length,
            minutes: doc.config.timerMinutes,
          })}
        </p>
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="mb-4 break-inside-avoid">
          <p className="font-medium">
            {i + 1}. {q.text}
            {q.points > 1 && <span className="text-sm text-zinc-700"> ({q.points} pts)</span>}
          </p>
          {q.imageId && (
            <Image
              src={`/api/image/${q.imageId}`}
              alt={q.imageCaption ?? "figure"}
              width={200}
              height={150}
              unoptimized
              className="my-2 h-auto max-h-32 w-auto"
            />
          )}
          <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-800">
            <span className="font-semibold">{answerLabel}</span>{" "}
            {answerFor(q, locale)}
          </p>
          {q.explanation && (
            <p className="mt-1 text-xs text-zinc-700">
              {explanationLabel} {q.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
