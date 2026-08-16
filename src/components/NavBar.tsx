"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LangToggle } from "@/components/LangToggle";
import { useI18n } from "@/stores/locale";

export function NavBar() {
  const router = useRouter();
  const { t } = useI18n();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-zinc-900">
          Quiz<span className="text-indigo-600">Forge</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <LangToggle />
          <Link href="/create" className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700">
            {t("NavBar", "+ New quiz")}
          </Link>
          <button onClick={logout} className="text-zinc-700 hover:text-zinc-900">
            {t("Common", "Sign out")}
          </button>
        </div>
      </div>
    </header>
  );
}
