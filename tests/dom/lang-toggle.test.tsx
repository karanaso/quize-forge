import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LangToggle } from "@/components/LangToggle";
import { I18nProvider } from "@/stores/locale";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderToggle(initialLocale: "en" | "el" = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <LangToggle />
    </I18nProvider>,
  );
}

describe("LangToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "quizforge:lang=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  });

  it("starts in English and switches to Greek on click, persisting the choice", () => {
    renderToggle("en");

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("EL");
    expect(button).toHaveAccessibleName("Switch to Greek");

    fireEvent.click(button);

    expect(button).toHaveTextContent("EN");
    expect(button).toHaveAccessibleName("Μετάβαση στα Αγγλικά");
    expect(window.localStorage.getItem("quizforge:lang")).toBe("el");
    expect(document.cookie).toContain("quizforge:lang=el");
  });

  it("renders in Greek when seeded with the Greek locale", () => {
    renderToggle("el");
    expect(screen.getByRole("button")).toHaveTextContent("EN");
    expect(screen.getByRole("button")).toHaveAccessibleName("Μετάβαση στα Αγγλικά");
  });
});
