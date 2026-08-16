import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LangToggle } from "@/components/LangToggle";
import { useLocaleStore } from "@/stores/locale";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("LangToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "quizforge:lang=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    useLocaleStore.setState({ locale: "en" });
  });

  it("starts in English and switches to Greek on click, persisting the choice", () => {
    render(<LangToggle />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("EL");
    expect(useLocaleStore.getState().locale).toBe("en");

    fireEvent.click(button);

    expect(button).toHaveTextContent("EN");
    expect(useLocaleStore.getState().locale).toBe("el");
    expect(window.localStorage.getItem("quizforge:lang")).toBe("el");
    expect(document.cookie).toContain("quizforge:lang=el");
  });

  it("exposes a localized accessible label", () => {
    render(<LangToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Switch to Greek");
  });
});
