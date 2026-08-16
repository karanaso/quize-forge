"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/stores/locale";

export function LangToggle({ className }: { className?: string }) {
  const router = useRouter();
  const { locale, toggle, t } = useI18n();

  return (
    <button
      onClick={() => {
        toggle();
        router.refresh();
      }}
      title={locale === "en" ? "Ελληνικά" : "English"}
      aria-label={
        locale === "en"
          ? t("LangToggle", "Switch to Greek")
          : t("LangToggle", "Switch to English")
      }
      className={`rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 ${className ?? ""}`}
    >
      {locale === "en" ? "EL" : "EN"}
    </button>
  );
}
