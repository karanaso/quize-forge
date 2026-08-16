import { requireTeacher } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { QuizList } from "@/components/QuizList";
import { renderT } from "@/lib/i18n-server";

export default async function DashboardPage() {
  await requireTeacher();
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">
          {await renderT("Dashboard", "Your quizzes")}
        </h1>
        <QuizList />
      </main>
    </>
  );
}
