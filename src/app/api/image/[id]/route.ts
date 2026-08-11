import { NextResponse } from "next/server";
import { streamImage } from "@/lib/storage";
import type { GridFSBucketReadStream } from "mongodb";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const headers = new Headers();
  let stream: GridFSBucketReadStream;
  try {
    stream = await streamImage(id, ({ contentType, length }) => {
      headers.set("Content-Type", contentType);
      headers.set("Content-Length", String(length));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(stream as unknown as ReadableStream, { headers });
}
