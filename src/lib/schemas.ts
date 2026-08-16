import { z } from "zod";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const QUESTION_TYPES = ["mc", "tf", "fill", "matching"] as const;

export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

// ---------- Question types ----------

export const mcQuestionSchema = z.object({
  kind: z.literal("mc"),
  text: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().optional().default(""),
});

export const tfQuestionSchema = z.object({
  kind: z.literal("tf"),
  text: z.string().min(1),
  correct: z.boolean(),
  explanation: z.string().optional().default(""),
});

export const fillQuestionSchema = z.object({
  kind: z.literal("fill"),
  text: z.string().min(1),
  blank: z.string().min(1),
  acceptableAnswers: z.array(z.string().min(1)).min(1).max(5),
  explanation: z.string().optional().default(""),
});

export const matchingQuestionSchema = z.object({
  kind: z.literal("matching"),
  text: z.string().min(1).optional().default(""),
  pairs: z
    .array(
      z.object({
        left: z.string().min(1),
        right: z.string().min(1),
      }),
    )
    .min(2)
    .max(8),
  explanation: z.string().optional().default(""),
});

export const questionSchema = z.discriminatedUnion("kind", [
  mcQuestionSchema,
  tfQuestionSchema,
  fillQuestionSchema,
  matchingQuestionSchema,
]);

export type McQuestion = z.infer<typeof mcQuestionSchema>;
export type TfQuestion = z.infer<typeof tfQuestionSchema>;
export type FillQuestion = z.infer<typeof fillQuestionSchema>;
export type MatchingQuestion = z.infer<typeof matchingQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;

export type QuestionKind = Question["kind"];

// A question as persisted in MongoDB (adds id, points, optional image)
export const persistedQuestionSchema = questionSchema
  .and(
    z.object({
      id: z.string(),
      points: z.number().int().min(1).max(100).default(1),
      imageId: z.string().optional(),
      imageCaption: z.string().optional(),
    }),
  )
  .refine((q) => {
    if (q.kind === "matching") {
      return q.pairs.every(
        (p, i) => q.pairs.findIndex((x) => x.left === p.left) === i,
      );
    }
    return true;
  }, "Matching question has duplicate terms");

export type PersistedQuestion = z.infer<typeof persistedQuestionSchema>;

// ---------- Quiz ----------

export const quizConfigSchema = z.object({
  timerMinutes: z.number().int().min(1).max(180).default(10),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
});
export type QuizConfig = z.infer<typeof quizConfigSchema>;

export const quizSchema = z.object({
  _id: z.string(),
  title: z.string().min(1),
  pdfId: z.string().optional(),
  sourceFilename: z.string().optional(),
  pageFrom: z.number().int().min(1),
  pageTo: z.number().int().min(1),
  difficulty: difficultySchema,
  language: z.string().min(1),
  questions: z.array(persistedQuestionSchema),
  config: quizConfigSchema,
  status: z.enum(["draft", "published"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Quiz = z.infer<typeof quizSchema>;

// ---------- Student identity ----------

export const studentIdentitySchema = z.object({
  school: z.string().min(1, "School name is required").max(120),
  className: z.string().min(1, "Class name is required").max(120),
  studentName: z.string().min(1, "Student name is required").max(120),
});
export type StudentIdentity = z.infer<typeof studentIdentitySchema>;

// ---------- Attempt / answers ----------

export const mcAnswerSchema = z.object({
  questionId: z.string(),
  kind: z.literal("mc"),
  selectedIndex: z.number().int().min(0).max(3),
});

export const tfAnswerSchema = z.object({
  questionId: z.string(),
  kind: z.literal("tf"),
  value: z.boolean(),
});

export const fillAnswerSchema = z.object({
  questionId: z.string(),
  kind: z.literal("fill"),
  text: z.string().max(200),
});

export const matchingAnswerSchema = z.object({
  questionId: z.string(),
  kind: z.literal("matching"),
  pairings: z.array(
    z.object({
      left: z.string(),
      right: z.string(),
    }),
  ),
});

export const answerSchema = z.discriminatedUnion("kind", [
  mcAnswerSchema,
  tfAnswerSchema,
  fillAnswerSchema,
  matchingAnswerSchema,
]);
export type Answer = z.infer<typeof answerSchema>;

export const attemptSchema = z.object({
  quizId: z.string(),
  identity: studentIdentitySchema,
  answers: z.array(answerSchema),
  startedAt: z.coerce.date(),
});
export type AttemptInput = z.infer<typeof attemptSchema>;

// ---------- Generation request (teacher wizard) ----------

export const generationRequestSchema = z.object({
  pdfId: z.string(),
  pageFrom: z.number().int().min(1),
  pageTo: z.number().int().min(1),
  questionCount: z.number().int().min(1).max(50).default(10),
  difficulty: difficultySchema.default("medium"),
  timerMinutes: z.number().int().min(1).max(180).default(10),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  uiLang: z.enum(["en", "el"]).default("en"),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const encryptedPayloadSchema = z.object({
  requestId: z.string(),
  ciphertext: z.string(),
  iv: z.string(),
});
export type EncryptedPayload = z.infer<typeof encryptedPayloadSchema>;
