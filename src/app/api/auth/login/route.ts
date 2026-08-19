import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveUserId, getSession, isAuthorized } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = loginSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isAuthorized(body.data.username, body.data.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = deriveUserId(body.data.username);
  await session.save();

  return NextResponse.json({ ok: true });
}
