import { getPublicQuiz } from "@/lib/public";
import { StudentQuiz } from "@/components/StudentQuiz";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const quiz = await getPublicQuiz(quizId);
  if (!quiz) notFound();

  return (
    <main className="mx-auto w-full flex-1 px-4 py-8">
      <StudentQuiz quiz={quiz} />
    </main>
  );
}
