"use client";

import { create } from "zustand";
import type { StudentIdentity } from "@/lib/schemas";

interface StudentState {
  identity: StudentIdentity | null;
  setIdentity: (identity: StudentIdentity) => void;
  reset: () => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  identity: null,
  setIdentity: (identity) => set({ identity }),
  reset: () => set({ identity: null }),
}));
