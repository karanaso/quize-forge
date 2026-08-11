import { requireTeacher } from "@/lib/auth";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { Quiz } from "@/lib/models/quiz";
import { NavBar } from "@/components/NavBar";
import { TeacherResults } from "@/components/TeacherResults";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
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

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">{doc.title}</h1>
        <TeacherResults
          quizId={doc._id.toString()}
          questionCount={doc.questions.length}
        />
      </main>
    </>
  );
}
