import { Quiz } from "@/lib/models/quiz";
import { Pdf } from "@/lib/models/pdf";
import { dbConnect } from "@/lib/db";

/**
 * Claim quizzes and PDFs that predate ownership (no ownerId) for the given
 * user. Idempotent: once every document has an ownerId this is a cheap
 * no-op, so it is safe to run on every authenticated request.
 */
export async function ensureOwnership(userId: string): Promise<void> {
  await dbConnect();
  await Promise.all([
    Quiz.updateMany(
      { ownerId: { $exists: false } },
      { $set: { ownerId: userId } },
    ),
    Pdf.updateMany(
      { ownerId: { $exists: false } },
      { $set: { ownerId: userId } },
    ),
  ]);
}
