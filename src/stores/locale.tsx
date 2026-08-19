"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t as translate, LOCALE_COOKIE, type Locale, type TranslateVars } from "@/lib/i18n";

const STORAGE_KEY = "quizforge:lang";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
  t: (namespace: string, key: string, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Client locale provider. The server renders with `initialLocale` (resolved
 * from the cookie / Accept-Language in the root layout), so the SSR HTML and
 * the hydration render always agree. After mount a stored browser preference
 * is adopted if it differs (e.g. the cookie was cleared).
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "el") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
      return;
    }
    if ((navigator.language ?? "").toLowerCase().startsWith("el")) {
      setLocaleState("el");
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    }
    setLocaleState(next);
  }, []);

  const toggle = useCallback(() => {
    setLocaleState((current) => {
      const next: Locale = current === "en" ? "el" : "en";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (namespace: string, key: string, vars?: TranslateVars) =>
      translate(locale, namespace, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggle, t }),
    [locale, setLocale, toggle, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
