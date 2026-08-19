import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentQuiz, type PublicQuiz } from "@/components/StudentQuiz";
import { useStudentStore } from "@/stores/student";
import { I18nProvider } from "@/stores/locale";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const quiz: PublicQuiz = {
  id: "quiz-1",
  title: "Test quiz",
  questions: [
    {
      id: "q1",
      points: 1,
      kind: "mc",
      text: "What is the powerhouse of the cell?",
      options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
    },
  ],
  config: { timerMinutes: 10, shuffleQuestions: false, shuffleOptions: false },
};

function renderQuiz() {
  return render(
    <I18nProvider initialLocale="en">
      <StudentQuiz quiz={quiz} />
    </I18nProvider>,
  );
}

describe("StudentQuiz header", () => {
  beforeEach(() => {
    useStudentStore.setState({ identity: { school: "S", className: "C", studentName: "N" } });
  });

  it("keeps the header sticky so it stays visible while scrolling", () => {
    renderQuiz();

    const heading = screen.getByRole("heading", { level: 1, name: /Test quiz/ });
    const header = heading.closest("div.sticky");
    expect(header).not.toBeNull();
    expect(header?.className).toContain("top-0");
  });

  it("does not clip sticky positioning with an overflow-hidden ancestor", () => {
    renderQuiz();

    const backdrop = screen.getByTestId("happy-backdrop");
    expect(backdrop).not.toHaveClass("overflow-hidden");
    expect(backdrop.className).toContain("min-h-screen");
  });
});
