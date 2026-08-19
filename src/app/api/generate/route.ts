import { NextResponse } from "next/server";
import { Pdf } from "@/lib/models/pdf";
import { dbConnect } from "@/lib/db";
import { requireTeacher } from "@/lib/auth";
import { decryptOneTimeKey } from "@/lib/crypto";
import { downloadFile, saveImage } from "@/lib/storage";
import { rasterizePage, cropRaster } from "@/lib/pdf";
import {
  createClient,
  extractDigest,
  draftQuestions,
  type ProgressFn,
} from "@/lib/ai";
import { serverT, type Locale } from "@/lib/i18n";
import { generationRequestSchema, encryptedPayloadSchema, persistedQuestionSchema } from "@/lib/schemas";

const MAX_RANGE_PAGES = 10;

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireTeacher();

  const body = await request.json().catch(() => null);
  const payload = generationRequestSchema.safeParse(body?.payload);
  const encrypted = encryptedPayloadSchema.safeParse(body?.encrypted);
  if (!payload.success || !encrypted.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const locale: Locale = payload.data.uiLang;

  const apiKey = decryptOneTimeKey(
    encrypted.data.requestId,
    encrypted.data.ciphertext,
    encrypted.data.iv,
  );
  if (!apiKey) {
    return NextResponse.json(
      { error: serverT(locale, "Generate", "Invalid or expired encryption key. Please refresh and try again.") },
      { status: 401 },
    );
  }

  const { pageFrom, pageTo, questionCount, difficulty } = payload.data;
  if (pageFrom > pageTo || pageTo - pageFrom + 1 > MAX_RANGE_PAGES) {
    return NextResponse.json(
      { error: serverT(locale, "Generate", "Page range must be between 1 and {max} pages", { max: MAX_RANGE_PAGES }) },
      { status: 400 },
    );
  }

  await dbConnect();
  const pdf = await Pdf.findOne({ _id: payload.data.pdfId, ownerId: session.userId });
  if (!pdf) {
    return NextResponse.json(
      { error: serverT(locale, "Generate", "PDF not found") },
      { status: 404 },
    );
  }
  if (pageTo > pdf.pageCount) {
    return NextResponse.json(
      { error: serverT(locale, "Generate", "Page range exceeds PDF ({count} pages)", { count: pdf.pageCount }) },
      { status: 400 },
    );
  }

  const client = createClient(apiKey);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const progress: ProgressFn = (message) => send("progress", { message });

      try {
        progress(serverT(locale, "Generate", "Loading PDF {name}…", { name: pdf.originalName }));
        const pdfBuffer = await downloadFile(pdf.gridfsId);

        const pages = [];
        for (let page = pageFrom; page <= pageTo; page++) {
          progress(
            serverT(locale, "Generate", "Reading page {page} of {total}…", {
              page: page - pageFrom + 1,
              total: pageTo - pageFrom + 1,
            }),
          );
          const raster = await rasterizePage(new Uint8Array(pdfBuffer), page);
          pages.push({ pageNumber: page, raster });
        }

        const digest = await extractDigest(client, pages, progress, locale);

        progress(serverT(locale, "Generate", "Drafting questions…"));
        const drafted = await draftQuestions(
          client,
          digest,
          {
            questionCount,
            difficulty,
            mix: "mc-tf-heavy",
          },
          locale,
        );

        const figureByPageLabel = new Map<string, { raster: Buffer }>();
        for (const page of pages) {
          for (const fig of digest.figures.filter((f) => f.page === page.pageNumber)) {
            figureByPageLabel.set(`${fig.page}:${fig.label}`, { raster: page.raster });
          }
        }

        const questions = [];
        for (const q of drafted) {
          const question: Record<string, unknown> = {
            ...q,
            id: crypto.randomUUID(),
            points: 1,
            explanation: q.explanation ?? "",
          };
          if (q.imageRef) {
            const fig = digest.figures.find(
              (f) => f.page === q.imageRef!.page && f.label === q.imageRef!.label,
            );
            const page = figureByPageLabel.get(
              `${q.imageRef.page}:${q.imageRef.label}`,
            );
            if (fig && page) {
              const cropped = cropRaster(page.raster, fig.bbox);
              question.imageId = await saveImage(cropped);
              question.imageCaption = fig.label;
            }
          }
          delete question.imageRef;
          const parsed = persistedQuestionSchema.safeParse(question);
          if (parsed.success) questions.push(parsed.data);
          else
            progress(
              serverT(locale, "Generate", "Skipped an invalid question: {reason}", {
                reason: parsed.error.issues[0]?.message ?? "schema error",
              }),
            );
        }

        const draft = {
          title: `${digest.topic} quiz`,
          language: digest.language,
          questions,
        };

        send("done", { ok: true, draft });
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : serverT(locale, "Generate", "Generation failed");
        send("error", { error: message });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
