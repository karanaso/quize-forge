import { NextResponse } from "next/server";
import { z } from "zod";
import { Quiz } from "@/lib/models/quiz";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { persistedQuestionSchema, quizConfigSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadQuiz(id: string, ownerId: string) {
  if (!isValidObjectId(id)) return null;
  const doc = await Quiz.findOne({ _id: id, ownerId }).lean();
  return doc;
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireTeacher();
  await dbConnect();
  const { id } = await ctx.params;
  const doc = await loadQuiz(id, session.userId!);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ quiz: doc });
}

const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  questions: z.array(persistedQuestionSchema).min(1).optional(),
  config: quizConfigSchema.optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export async function PUT(request: Request, ctx: Ctx) {
  const session = await requireTeacher();
  await dbConnect();
  const { id } = await ctx.params;
  const doc = await loadQuiz(id, session.userId!);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = updateQuizSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid quiz" },
      { status: 400 },
    );
  }
  await Quiz.updateOne({ _id: doc._id }, { $set: body.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireTeacher();
  await dbConnect();
  const { id } = await ctx.params;
  const doc = await loadQuiz(id, session.userId!);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await Quiz.deleteOne({ _id: doc._id });
  return NextResponse.json({ ok: true });
}
