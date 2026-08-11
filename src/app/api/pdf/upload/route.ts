import { NextResponse } from "next/server";
import { Pdf } from "@/lib/models/pdf";
import { uploadPdf } from "@/lib/storage";
import { getPdfPageCount } from "@/lib/pdf";
import { requireTeacher } from "@/lib/auth";
import { dbConnect } from "@/lib/db";

export const maxDuration = 60;
export const runtime = "nodejs";

export const MAX_UPLOAD_PAGES = 20;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  await requireTeacher();

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "PDF too large (max 50 MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  try {
    pageCount = await getPdfPageCount(new Uint8Array(bytes));
  } catch (err) {
    console.error("PDF parse failed:", err);
    return NextResponse.json({ error: "Could not read PDF" }, { status: 422 });
  }
  if (pageCount > MAX_UPLOAD_PAGES) {
    return NextResponse.json(
      { error: `PDF has ${pageCount} pages; maximum is ${MAX_UPLOAD_PAGES}` },
      { status: 400 },
    );
  }

  await dbConnect();
  const filename = `${crypto.randomUUID()}.pdf`;
  const gridfsId = await uploadPdf(filename, file.name, bytes);
  const doc = await Pdf.create({
    filename,
    originalName: file.name,
    pageCount,
    size: bytes.length,
    gridfsId,
  });

  return NextResponse.json({
    pdfId: doc._id.toString(),
    filename: file.name,
    pageCount,
  });
}
