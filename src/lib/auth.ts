import { getIronSession, type SessionOptions } from "iron-session";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { ensureOwnership } from "@/lib/ownership";

export const sessionOptions: SessionOptions = {
  cookieName: "quizforge_session",
  password: process.env.SESSION_SECRET ?? "change-me-to-a-long-random-string",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export interface SessionData {
  userId?: string;
}

/**
 * Derive a stable, opaque user id from the teacher username. Kept
 * deterministic so existing data can be migrated and so a future User
 * collection can expose the same id as a unique publicId without a
 * migration.
 */
export function deriveUserId(username: string): string {
  return createHash("sha256").update(username).digest("hex");
}

export function isAuthorized(username: string, password: string): boolean {
  const envUser = process.env.TEACHER_USERNAME;
  const envPass = process.env.TEACHER_PASSWORD;
  if (!envUser || !envPass) return false;
  return username === envUser && password === envPass;
}

export const getSession = cache(async () => {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
});

/** Redirects to /login when the teacher is not authenticated. */
export async function requireTeacher(): Promise<SessionData> {
  const session = await getSession();
  const userId = session.userId;
  if (!userId) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    throw new Error("unreachable");
  }
  await ensureOwnership(userId);
  return session;
}
