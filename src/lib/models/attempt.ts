import { Schema, model, models, type Types } from "mongoose";

const attemptSchema = new Schema(
  {
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    school: { type: String, required: true },
    className: { type: String, required: true },
    studentName: { type: String, required: true },
    answers: { type: [Object], required: true, default: [] },
    score: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    durationSec: { type: Number, required: true, default: 0 },
    startedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

attemptSchema.index({ quizId: 1, school: 1, className: 1, studentName: 1 });

export interface AttemptDoc {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  school: string;
  className: string;
  studentName: string;
  answers: unknown[];
  score: number;
  totalPoints: number;
  correctCount: number;
  durationSec: number;
  startedAt: Date;
  createdAt: Date;
}

const AttemptModel = models.Attempt ?? model("Attempt", attemptSchema);

export const Attempt = AttemptModel as typeof AttemptModel;
