import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuizEditor } from "@/components/QuizEditor";
import { useEditorStore } from "@/stores/editor";
import { I18nProvider } from "@/stores/locale";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

const questions = [
  {
    id: "q1",
    kind: "mc" as const,
    text: "What is the powerhouse of the cell?",
    options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
    correctIndex: 1,
    points: 1,
    explanation: "",
  },
];

function renderEditor(initialVideoUrl = "") {
  return render(
    <I18nProvider initialLocale="en">
      <QuizEditor
        quizId="quiz-1"
        initialTitle="Biology quiz"
        initialQuestions={questions}
        initialStatus="draft"
        initialVideoUrl={initialVideoUrl}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useEditorStore.getState().reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QuizEditor video URL", () => {
  it("shows the video field and pre-fills it from the quiz", () => {
    renderEditor("https://youtu.be/abc123xyzAB");
    expect(screen.getByLabelText(/YouTube video URL/i)).toHaveValue(
      "https://youtu.be/abc123xyzAB",
    );
  });

  it("blocks saving an invalid URL with an inline error", async () => {
    renderEditor();
    const input = screen.getByLabelText(/YouTube video URL/i);
    fireEvent.change(input, { target: { value: "https://vimeo.com/12345" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/invalid youtube url/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a valid URL with the quiz", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderEditor();

    const input = screen.getByLabelText(/YouTube video URL/i);
    fireEvent.change(input, {
      target: { value: "https://www.youtube.com/watch?v=abc123xyzAB" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/quiz/quiz-1");
    expect(JSON.parse((opts as { body: string }).body)).toMatchObject({
      videoUrl: "https://www.youtube.com/watch?v=abc123xyzAB",
    });
  });
});
