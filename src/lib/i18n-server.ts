import { cookies, headers } from "next/headers";
import { t, type Locale, type TranslateVars } from "@/lib/i18n";

export const LOCALE_COOKIE = "quizforge:lang";

/** Resolve the UI locale for server-rendered pages: cookie, then Accept-Language. */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie === "en" || fromCookie === "el") return fromCookie;

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().startsWith("el") ? "el" : "en";
}

/** Translation helper for server components. */
export async function renderT(
  namespace: string,
  key: string,
  vars?: TranslateVars,
): Promise<string> {
  return t(await getServerLocale(), namespace, key, vars);
}
