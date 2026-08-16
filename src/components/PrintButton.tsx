"use client";

import { useI18n } from "@/stores/locale";

export function PrintButton() {
  const { t } = useI18n();
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 print:hidden"
    >
      {t("Print", "Print / Save as PDF")}
    </button>
  );
}
