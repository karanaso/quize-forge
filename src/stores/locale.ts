"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { t as translate, LOCALE_COOKIE, type Locale, type TranslateVars } from "@/lib/i18n";

const STORAGE_KEY = "quizforge:lang";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  if (cookie === "en" || cookie === "el") return cookie;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "el") return stored;
  return (navigator.language ?? "").toLowerCase().startsWith("el") ? "el" : "en";
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
    }
    set({ locale });
  },
  toggle: () => get().setLocale(get().locale === "en" ? "el" : "en"),
}));

/** Client hook: current locale, setter/toggle, and a `t(ns, key, vars)` helper. */
export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const toggle = useLocaleStore((s) => s.toggle);
  const t = useCallback(
    (namespace: string, key: string, vars?: TranslateVars) =>
      translate(locale, namespace, key, vars),
    [locale],
  );
  return { locale, setLocale, toggle, t };
}
