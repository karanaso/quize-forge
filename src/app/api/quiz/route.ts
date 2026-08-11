import { NextResponse } from "next/server";
import { z } from "zod";
import { Quiz } from "@/lib/models/quiz";
import { dbConnect } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { persistedQuestionSchema, quizConfigSchema, difficultySchema } from "@/lib/schemas";

export const runtime = "nodejs";

const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  pdfId: z.string().optional(),
  sourceFilename: z.string().optional(),
  pageFrom: z.number().int().min(1),
  pageTo: z.number().int().min(1),
  difficulty: difficultySchema,
  language: z.string().min(1),
  questions: z.array(persistedQuestionSchema).min(1),
  config: quizConfigSchema,
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function POST(request: Request) {
  await requireTeacher();
  const body = createQuizSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid quiz" },
      { status: 400 },
    );
  }

  await dbConnect();
  const doc = await Quiz.create(body.data);
  return NextResponse.json({ id: doc._id.toString() }, { status: 201 });
}

export async function GET() {
  await requireTeacher();
  await dbConnect();
  const docs = await Quiz.find()
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    quizzes: docs.map((d: any) => ({
      id: d._id.toString(),
      title: d.title,
      status: d.status,
      sourceFilename: d.sourceFilename ?? null,
      pageFrom: d.pageFrom,
      pageTo: d.pageTo,
      difficulty: d.difficulty,
      language: d.language,
      questionCount: d.questions.length,
      timerMinutes: d.config.timerMinutes,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
}
