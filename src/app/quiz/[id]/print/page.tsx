import Image from "next/image";
import { requireTeacher } from "@/lib/auth";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { Quiz } from "@/lib/models/quiz";
import { PrintButton } from "@/components/PrintButton";
import { renderT } from "@/lib/i18n-server";
import type { PersistedQuestion } from "@/lib/schemas";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function renderQuestion(q: PersistedQuestion, idx: number) {
  const body = () => {
    switch (q.kind) {
      case "mc":
        return (
          <ol className="mt-2 space-y-1 pl-5">
            {q.options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border border-zinc-400" />
                {o}
              </li>
            ))}
          </ol>
        );
      case "tf":
        return (
          <div className="mt-2 flex gap-6 pl-5 text-zinc-700">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border border-zinc-400" />{" "}
              <PrintWord ns="Print" keyName="True" />
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border border-zinc-400" />{" "}
              <PrintWord ns="Print" keyName="False" />
            </span>
          </div>
        );
      case "fill":
        return (
          <div className="mt-3 pl-5">
            <div className="inline-block w-40 border-b border-zinc-400" />
          </div>
        );
      case "matching":
        return (
          <div className="mt-3 grid grid-cols-2 gap-6 pl-5">
            <ol className="space-y-3">
              {q.pairs.map((p, i) => (
                <li key={i} className="border-b border-dotted border-zinc-400 pb-1">
                  {p.left}
                </li>
              ))}
            </ol>
            <ol className="space-y-3">
              {q.pairs.map((p, i) => (
                <li key={i} className="border-b border-dotted border-zinc-400 pb-1">
                  {p.right}
                </li>
              ))}
            </ol>
          </div>
        );
    }
  };

  return (
    <div key={q.id} className="mb-5 break-inside-avoid">
      <p className="font-medium">
        {idx + 1}. {q.text}
        {q.points > 1 && <span className="text-sm text-zinc-700"> ({q.points} pts)</span>}
      </p>
      {q.imageId && (
        <Image
          src={`/api/image/${q.imageId}`}
          alt={q.imageCaption ?? "figure"}
          width={300}
          height={200}
          unoptimized
          className="my-2 h-auto max-h-40 w-auto"
        />
      )}
      {body()}
    </div>
  );
}

async function PrintWord({ ns, keyName }: { ns: string; keyName: string }) {
  return <>{await renderT(ns, keyName)}</>;
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireTeacher();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await dbConnect();
  const doc = await Quiz.findOne({ _id: id, ownerId: session.userId }).lean();
  if (!doc) notFound();

  const questions = (doc.questions ?? []) as unknown as PersistedQuestion[];

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-8 flex items-start justify-between print:hidden">
        <h1 className="text-xl font-bold text-zinc-900">
          {await renderT("Print", "Print")}
        </h1>
        <div className="flex gap-2">
          <a
            href={`/quiz/${id}/print/answers`}
            target="_blank"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            {await renderT("Print", "Answer key")}
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-2xl font-bold">{doc.title}</h1>
        <p className="text-sm text-zinc-700">
          {await renderT("Print", "{source} · pages {from}–{to} · {count} questions · {minutes} minutes", {
            source: doc.sourceFilename ?? (await renderT("Print", "Quiz")),
            from: doc.pageFrom,
            to: doc.pageTo,
            count: doc.questions.length,
            minutes: doc.config.timerMinutes,
          })}
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          {await renderT("Print", "Name: ______________________ Class: ______________________ Date: ______________________")}
        </p>
      </div>

      {questions.map(renderQuestion)}
    </div>
  );
}
