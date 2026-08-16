import en from "@/locales/en.json";
import el from "@/locales/el.json";

export type Locale = "en" | "el";

export const LOCALES: Locale[] = ["en", "el"];

export const LOCALE_COOKIE = "quizforge:lang";

type Catalog = Record<string, Record<string, string>>;

const catalogs = { en, el } as unknown as Record<Locale, Catalog>;

export interface TranslateVars {
  [name: string]: string | number;
}

/**
 * Translate `key` under `namespace` for `locale`, falling back to English
 * and then to the raw key. `{name}` placeholders in the value are replaced
 * with the matching entry in `vars`.
 */
export function t(
  locale: Locale,
  namespace: string,
  key: string,
  vars?: TranslateVars,
): string {
  const catalog = catalogs[locale] ?? catalogs.en;
  const value =
    catalog[namespace]?.[key] ??
    catalogs.en[namespace]?.[key] ??
    key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translation for server-side code (API routes, AI prompts). */
export function serverT(
  locale: Locale,
  namespace: string,
  key: string,
  vars?: TranslateVars,
): string {
  return t(locale, namespace, key, vars);
}
