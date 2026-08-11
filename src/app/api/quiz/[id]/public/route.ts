import { NextResponse } from "next/server";
import { Quiz } from "@/lib/models/quiz";
import { dbConnect, isValidObjectId } from "@/lib/db";
import type { PersistedQuestion } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Student-facing quiz payload: question text/images only, all answers stripped.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await dbConnect();
  const doc = await Quiz.findOne({ _id: id, status: "published" }).lean();
  if (!doc) {
    return NextResponse.json({ error: "Quiz not found or unpublished" }, { status: 404 });
  }

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

  return NextResponse.json({
    quiz: {
      id: doc._id.toString(),
      title: doc.title,
      questions,
      config: doc.config,
    },
  });
}
