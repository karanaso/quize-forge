import { getPublicQuiz } from "@/lib/public";
import { StudentResults } from "@/components/StudentResults";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentResultsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getPublicQuiz(quizId);
  if (!quiz) notFound();

  return (
    <main className="mx-auto w-full flex-1 px-4 py-8">
      <StudentResults quizId={quiz.id} quizTitle={quiz.title} />
    </main>
  );
}
