import { Schema, model, models, type Types } from "mongoose";

const pdfSchema = new Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    pageCount: { type: Number, required: true },
    size: { type: Number, required: true },
    gridfsId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

export interface PdfDoc {
  _id: Types.ObjectId;
  filename: string;
  originalName: string;
  pageCount: number;
  size: number;
  gridfsId: Types.ObjectId;
  createdAt: Date;
}

export const Pdf = (models.Pdf ?? model("Pdf", pdfSchema)) as any;
