import { Quiz } from "@/lib/models/quiz";
import { dbConnect, isValidObjectId } from "@/lib/db";
import type { PersistedQuestion } from "@/lib/schemas";

export interface PublicQuizPayload {
  id: string;
  title: string;
  questions: {
    id: string;
    points: number;
    imageId?: string;
    imageCaption?: string;
    kind: "mc" | "tf" | "fill" | "matching";
    text: string;
    options?: string[];
    leftItems?: string[];
    rightItems?: string[];
  }[];
  config: { timerMinutes: number; shuffleQuestions: boolean; shuffleOptions: boolean };
}

/** Load a published quiz with all answer data stripped. */
export async function getPublicQuiz(id: string): Promise<PublicQuizPayload | null> {
  if (!isValidObjectId(id)) return null;
  await dbConnect();

  const doc = await Quiz.findOne({ _id: id, status: "published" }).lean();
  if (!doc) return null;

  const questions = (doc.questions as PersistedQuestion[]).map((q) => {
    const base = {
      id: q.id,
      points: q.points,
      imageId: q.imageId,
      imageCaption: q.imageCaption,
    };
    switch (q.kind) {
      case "mc":
        return { ...base, kind: "mc" as const, text: q.text, options: q.options };
      case "tf":
        return { ...base, kind: "tf" as const, text: q.text };
      case "fill":
        return { ...base, kind: "fill" as const, text: q.text };
      case "matching":
        return {
          ...base,
          kind: "matching" as const,
          text: q.text,
          leftItems: q.pairs.map((p) => p.left),
          rightItems: q.pairs.map((p) => p.right),
        };
    }
  });

  return {
    id: doc._id.toString(),
    title: doc.title,
    questions,
    config: doc.config,
  };
}
