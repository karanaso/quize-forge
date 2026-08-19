import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { LangToggle } from "@/components/LangToggle";

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mb-8 flex w-full max-w-sm items-center justify-end">
        <LangToggle />
      </div>
      <h1 className="mb-8 text-3xl font-bold text-zinc-900">
        Quiz<span className="text-indigo-600">Forge</span>
      </h1>
      <LoginForm />
    </main>
  );
}
