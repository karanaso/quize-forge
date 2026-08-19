import { Schema, model, models, type Types } from "mongoose";

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ["mc", "tf", "fill", "matching"],
    },
    text: { type: String, required: true },
    options: { type: [String], required: false },
    correctIndex: { type: Number, required: false },
    correct: { type: Boolean, required: false },
    blank: { type: String, required: false },
    acceptableAnswers: { type: [String], required: false },
    pairs: {
      type: [{ left: String, right: String }],
      required: false,
    },
    points: { type: Number, required: true, default: 1 },
    imageId: { type: String, required: false },
    imageCaption: { type: String, required: false },
    explanation: { type: String, required: false, default: "" },
  },
  { _id: false },
);

const quizSchema = new Schema(
  {
    title: { type: String, required: true },
    ownerId: { type: String, required: false, index: true },
    videoUrl: { type: String, required: false },
    pdfId: { type: Schema.Types.ObjectId, required: false },
    sourceFilename: { type: String, required: false },
    pageFrom: { type: Number, required: true },
    pageTo: { type: Number, required: true },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    language: { type: String, required: true, default: "English" },
    questions: { type: [questionSchema], required: true, default: [] },
    config: {
      timerMinutes: { type: Number, required: true, default: 10 },
      shuffleQuestions: { type: Boolean, required: true, default: true },
      shuffleOptions: { type: Boolean, required: true, default: true },
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true },
);

export interface QuizDoc {
  _id: Types.ObjectId;
  title: string;
  ownerId?: string;
  videoUrl?: string;
  pdfId?: Types.ObjectId;
  sourceFilename?: string;
  pageFrom: number;
  pageTo: number;
  difficulty: "easy" | "medium" | "hard";
  language: string;
  questions: unknown[];
  config: {
    timerMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const QuizModel = models.Quiz ?? model("Quiz", quizSchema);

export const Quiz = QuizModel as typeof QuizModel;