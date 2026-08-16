import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CopiedDrawer } from "@/components/CopiedDrawer";
import { QuizList } from "@/components/QuizList";

const URL = "http://localhost:3000/q/abc123";

afterEach(() => {
  vi.useRealTimers();
});

describe("CopiedDrawer", () => {
  it("shows the confirmation and the copied url", () => {
    render(<CopiedDrawer url={URL} onDismiss={() => {}} />);

    expect(screen.getByText("Copied link")).toBeInTheDocument();
    expect(screen.getByText(URL)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status").className).toContain("quiz-drawer-in");
  });

  it("auto-dismisses after the delay", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(<CopiedDrawer url={URL} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("QuizList copy link", () => {
  const quiz = {
    id: "abc123",
    title: "Bio quiz",
    status: "published",
    sourceFilename: "bio.pdf",
    pageFrom: 1,
    pageTo: 5,
    difficulty: "medium",
    language: "English",
    questionCount: 10,
    timerMinutes: 10,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ quizzes: [quiz] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies the link and shows the bottom drawer", async () => {
    writeText.mockResolvedValue(undefined);
    render(<QuizList />);

    fireEvent.click(await screen.findByText("Copy link"));

    expect(writeText).toHaveBeenCalledWith(URL);
    expect(await screen.findByText("Copied link")).toBeInTheDocument();
    expect(screen.getByText(URL)).toBeInTheDocument();
  });

  it("shows no drawer when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<QuizList />);

    fireEvent.click(await screen.findByText("Copy link"));

    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByText("Copied link")).not.toBeInTheDocument();
  });

  it("shows no drawer when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    render(<QuizList />);

    fireEvent.click(await screen.findByText("Copy link"));

    await Promise.resolve();
    expect(screen.queryByText("Copied link")).not.toBeInTheDocument();
  });
});
