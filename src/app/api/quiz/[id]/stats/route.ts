import { NextResponse } from "next/server";
import { Attempt } from "@/lib/models/attempt";
import { dbConnect, isValidObjectId } from "@/lib/db";
import { computeQuestionStats, studentKey, type RawAttempt } from "@/lib/stats";
import { studentIdentitySchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Per-question "other students" stats for the student results screen.
 * Identity comes from query params; that student's best attempt is excluded.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const identity = studentIdentitySchema.safeParse({
    school: url.searchParams.get("school") ?? "",
    className: url.searchParams.get("class") ?? "",
    studentName: url.searchParams.get("student") ?? "",
  });
  if (!identity.success) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  await dbConnect();
  const attempts = (await Attempt.find({ quizId: id }).lean()) as unknown as RawAttempt[];
  const stats = computeQuestionStats(
    attempts,
    studentKey(
      identity.data.school,
      identity.data.className,
      identity.data.studentName,
    ),
  );

  return NextResponse.json({ stats: Object.fromEntries(stats) });
}
