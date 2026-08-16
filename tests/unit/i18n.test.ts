import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import en from "@/locales/en.json";
import el from "@/locales/el.json";

type Catalog = Record<string, Record<string, string>>;

describe("t", () => {
  it("returns the English value for en", () => {
    expect(t("en", "Common", "Copied link")).toBe("Copied link");
    expect(t("en", "QuizList", "Copy link")).toBe("Copy link");
  });

  it("returns the Greek value for el", () => {
    expect(t("el", "Common", "Copied link")).toBe("Ο σύνδεσμος αντιγράφηκε");
    expect(t("el", "StudentQuiz", "Let's go 🚀")).toBe("Πάμε 🚀");
    expect(t("el", "QuizList", "Copy link")).toBe("Αντιγραφή συνδέσμου");
  });

  it("falls back to the raw key for unknown namespaces/keys", () => {
    expect(t("en", "DoesNotExist", "Some missing string")).toBe("Some missing string");
    expect(t("el", "DoesNotExist", "Some missing string")).toBe("Some missing string");
  });

  it("interpolates {vars} placeholders", () => {
    expect(
      t("en", "QuizList", "{count} questions · {minutes} min", {
        count: 5,
        minutes: 10,
      }),
    ).toBe("5 questions · 10 min");
    expect(
      t("el", "QuizList", "{count} questions · {minutes} min", {
        count: 5,
        minutes: 10,
      }),
    ).toBe("5 ερωτήσεις · 10 λεπτά");
    expect(
      t("en", "Generate", "Reading page {page} of {total}…", { page: 1, total: 3 }),
    ).toBe("Reading page 1 of 3…");
  });

  it("leaves unknown vars intact instead of dropping them", () => {
    expect(t("en", "QuizList", "{count} questions", {})).toBe("{count} questions");
  });
});

describe("locale catalogs", () => {
  it("en and el define the same keys (no missing translations)", () => {
    const enNs = en as unknown as Catalog;
    const elNs = el as unknown as Catalog;
    const namespaces = new Set([
      ...Object.keys(enNs),
      ...Object.keys(elNs),
    ]);

    for (const ns of namespaces) {
      const enKeys = enNs[ns] ?? {};
      const elKeys = elNs[ns] ?? {};
      const keys = new Set([...Object.keys(enKeys), ...Object.keys(elKeys)]);
      for (const key of keys) {
        expect(enKeys[key], `en.${ns}.${key} is missing`).toBeTruthy();
        expect(elKeys[key], `el.${ns}.${key} is missing`).toBeTruthy();
      }
    }
  });
});
