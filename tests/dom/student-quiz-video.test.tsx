import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentQuiz, type PublicQuiz } from "@/components/StudentQuiz";
import { useStudentStore } from "@/stores/student";
import { I18nProvider } from "@/stores/locale";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseQuiz: PublicQuiz = {
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

function renderQuiz(overrides: Partial<PublicQuiz> = {}) {
  return render(
    <I18nProvider initialLocale="en">
      <StudentQuiz quiz={{ ...baseQuiz, ...overrides }} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  useStudentStore.setState({
    identity: { school: "S", className: "C", studentName: "N" },
  });
});

describe("StudentQuiz video", () => {
  it("embeds the converted video at the top of the quiz when present", () => {
    renderQuiz({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });

    const frame = screen.getByTitle("Instructional video");
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(frame).toHaveAttribute("allowfullscreen");
  });

  it("renders no video when the quiz has no videoUrl", () => {
    renderQuiz();
    expect(screen.queryByTitle("Instructional video")).not.toBeInTheDocument();
  });
});
