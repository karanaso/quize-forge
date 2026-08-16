import type {
  PersistedQuestion,
  Quiz,
  Answer,
} from "@/lib/schemas";

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function mcQuestion(
  overrides: Partial<PersistedQuestion> = {},
): PersistedQuestion {
  return {
    id: id("mc"),
    kind: "mc",
    text: "What is the powerhouse of the cell?",
    options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"],
    correctIndex: 1,
    points: 2,
    explanation: "",
    ...overrides,
  } as PersistedQuestion;
}

export function tfQuestion(
  overrides: Partial<PersistedQuestion> = {},
): PersistedQuestion {
  return {
    id: id("tf"),
    kind: "tf",
    text: "Photosynthesis converts light into chemical energy.",
    correct: true,
    points: 1,
    explanation: "",
    ...overrides,
  } as PersistedQuestion;
}

export function fillQuestion(
  overrides: Partial<PersistedQuestion> = {},
): PersistedQuestion {
  return {
    id: id("fill"),
    kind: "fill",
    text: "The cell organelle responsible for energy is the ____.",
    blank: "mitochondria",
    acceptableAnswers: ["mitochondria", "mitochondrion"],
    points: 2,
    explanation: "",
    ...overrides,
  } as PersistedQuestion;
}

export function matchingQuestion(
  overrides: Partial<PersistedQuestion> = {},
): PersistedQuestion {
  return {
    id: id("matching"),
    kind: "matching",
    text: "Match each organelle to its function.",
    pairs: [
      { left: "Mitochondria", right: "Energy production" },
      { left: "Ribosome", right: "Protein synthesis" },
    ],
    points: 2,
    explanation: "",
    ...overrides,
  } as PersistedQuestion;
}

export function makeQuiz(
  questions: PersistedQuestion[],
  overrides: Partial<Quiz> = {},
): Quiz {
  return {
    _id: "64f000000000000000000000",
    title: "Biology quiz",
    pageFrom: 1,
    pageTo: 1,
    difficulty: "medium",
    language: "English",
    questions,
    config: { timerMinutes: 10, shuffleQuestions: true, shuffleOptions: true },
    status: "published",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export const mcAnswer = (
  questionId: string,
  selectedIndex: number,
): Answer => ({ questionId, kind: "mc", selectedIndex });

export const tfAnswer = (questionId: string, value: boolean): Answer => ({
  questionId,
  kind: "tf",
  value,
});

export const fillAnswer = (questionId: string, text: string): Answer => ({
  questionId,
  kind: "fill",
  text,
});

export const matchingAnswer = (
  questionId: string,
  pairings: { left: string; right: string }[],
): Answer => ({ questionId, kind: "matching", pairings });
