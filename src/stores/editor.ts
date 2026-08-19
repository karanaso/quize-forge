"use client";

import { create } from "zustand";
import type { PersistedQuestion } from "@/lib/schemas";

interface EditorState {
  quizId: string | null;
  title: string;
  videoUrl: string;
  questions: PersistedQuestion[];
  dirty: boolean;

  load: (
    quizId: string,
    title: string,
    videoUrl: string,
    questions: PersistedQuestion[],
  ) => void;
  setTitle: (title: string) => void;
  setVideoUrl: (videoUrl: string) => void;
  updateQuestion: (id: string, patch: Partial<PersistedQuestion>) => void;
  addQuestion: (q: PersistedQuestion) => void;
  deleteQuestion: (id: string) => void;
  moveQuestion: (id: string, dir: -1 | 1) => void;
  markSaved: () => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  quizId: null,
  title: "",
  videoUrl: "",
  questions: [],
  dirty: false,

  load: (quizId, title, videoUrl, questions) =>
    set({ quizId, title, videoUrl, questions, dirty: false }),
  setTitle: (title) => set({ title, dirty: true }),
  setVideoUrl: (videoUrl) => set({ videoUrl, dirty: true }),
  updateQuestion: (id, patch) =>
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === id ? ({ ...q, ...patch } as PersistedQuestion) : q,
      ),
      dirty: true,
    })),
  addQuestion: (q) => set((s) => ({ questions: [...s.questions, q], dirty: true })),
  deleteQuestion: (id) =>
    set((s) => ({ questions: s.questions.filter((q) => q.id !== id), dirty: true })),
  moveQuestion: (id, dir) =>
    set((s) => {
      const i = s.questions.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.questions.length) return {};
      const questions = [...s.questions];
      const [item] = questions.splice(i, 1);
      questions.splice(j, 0, item);
      return { questions, dirty: true };
    }),
  markSaved: () => set({ dirty: false }),
  reset: () =>
    set({ quizId: null, title: "", videoUrl: "", questions: [], dirty: false }),
}));
