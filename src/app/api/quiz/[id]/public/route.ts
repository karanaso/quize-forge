import { NextResponse } from "next/server";
import { getPublicQuiz } from "@/lib/public";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const quiz = await getPublicQuiz(id);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found or unpublished" }, { status: 404 });
  }
  return NextResponse.json({ quiz });
}
