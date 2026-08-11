import { requireTeacher } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { CreateWizard } from "@/components/CreateWizard";

export default async function CreatePage() {
  await requireTeacher();
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">Create a quiz</h1>
        <CreateWizard />
      </main>
    </>
  );
}
