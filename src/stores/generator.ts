"use client";

import { create } from "zustand";
import type { Difficulty, Question, Quiz, QuizConfig } from "@/lib/schemas";

export interface UploadedPdf {
  pdfId: string;
  filename: string;
  pageCount: number;
}

export interface DraftQuiz {
  title: string;
  questions: (Question & { id: string })[];
  language: string;
}

interface GeneratorState {
  pdf: UploadedPdf | null;
  pageFrom: number | null;
  pageTo: number | null;
  questionCount: number;
  difficulty: Difficulty;
  config: QuizConfig;
  apiKey: string;
  busy: boolean;
  progress: string | null;
  error: string | null;
  draft: DraftQuiz | null;

  setPdf: (pdf: UploadedPdf) => void;
  setRange: (from: number, to: number) => void;
  setQuestionCount: (n: number) => void;
  setDifficulty: (d: Difficulty) => void;
  setConfig: (patch: Partial<QuizConfig>) => void;
  setApiKey: (key: string) => void;
  setBusy: (busy: boolean) => void;
  setProgress: (msg: string | null) => void;
  setError: (err: string | null) => void;
  setDraft: (draft: DraftQuiz) => void;
  reset: () => void;
}

const initialConfig: QuizConfig = {
  timerMinutes: 10,
  shuffleQuestions: true,
  shuffleOptions: true,
};

export const useGeneratorStore = create<GeneratorState>((set) => ({
  pdf: null,
  pageFrom: null,
  pageTo: null,
  questionCount: 10,
  difficulty: "medium",
  config: initialConfig,
  apiKey: "",
  busy: false,
  progress: null,
  error: null,
  draft: null,

  setPdf: (pdf) => set({ pdf, pageFrom: 1, pageTo: pdf.pageCount }),
  setRange: (pageFrom, pageTo) => set({ pageFrom, pageTo }),
  setQuestionCount: (questionCount) => set({ questionCount }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setConfig: (patch) =>
    set((s) => ({ config: { ...s.config, ...patch } })),
  setApiKey: (apiKey) => set({ apiKey }),
  setBusy: (busy) => set({ busy }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setDraft: (draft) => set({ draft }),
  reset: () =>
    set({
      pdf: null,
      pageFrom: null,
      pageTo: null,
      questionCount: 10,
      difficulty: "medium",
      config: initialConfig,
      apiKey: "",
      busy: false,
      progress: null,
      error: null,
      draft: null,
    }),
}));
