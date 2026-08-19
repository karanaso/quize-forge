import { requireTeacher } from "@/lib/auth";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { Quiz } from "@/lib/models/quiz";
import { NavBar } from "@/components/NavBar";
import { QuizEditor } from "@/components/QuizEditor";
import { persistedQuestionSchema } from "@/lib/schemas";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditPage({
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

  const questions = (doc.questions as unknown[]).filter((q) =>
    persistedQuestionSchema.safeParse(q).success,
  );

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <QuizEditor
          quizId={doc._id.toString()}
          initialTitle={doc.title}
          initialQuestions={questions as never}
          initialStatus={doc.status}
          initialVideoUrl={doc.videoUrl}
        />
      </main>
    </>
  );
}
