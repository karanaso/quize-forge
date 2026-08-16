import { createCanvas, DOMMatrix, ImageData, Image } from "@napi-rs/canvas";

// pdfjs-dist is ESM-only; load lazily so it never touches the client bundle.
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
    (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
  }
  if (typeof (globalThis as Record<string, unknown>).ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = ImageData;
  }
  return pdfjs;
}

const DEFAULT_SCALE = 2; // ~144 DPI

class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: { canvas: HTMLCanvasElement }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: {
    canvas: HTMLCanvasElement | null;
    context: unknown;
  }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function openDocument(data: Uint8Array) {
  const pdfjs = await loadPdfjs();
  // pdfjs transfers (detaches) the buffer passed as `data`; copy so the
  // caller's buffer stays intact across repeated rasterize/open calls.
  const copy = new Uint8Array(data);
  const task = pdfjs.getDocument({
    data: copy,
    useWorkerFetch: false,
    useSystemFonts: true,
    CanvasFactory: NapiCanvasFactory,
  });
  const doc = await task.promise;
  return { doc, task };
}

async function closeDocument(task: {
  destroy: () => Promise<void>;
}): Promise<void> {
  try {
    await task.destroy();
  } catch {
    // teardown is best-effort
  }
}

export async function getPdfPageCount(data: Uint8Array): Promise<number> {
  const { doc, task } = await openDocument(data);
  try {
    return doc.numPages;
  } finally {
    await closeDocument(task);
  }
}

/** Rasterize a single page (1-indexed) to a PNG buffer. */
export async function rasterizePage(
  data: Uint8Array,
  pageNumber: number,
  scale = DEFAULT_SCALE,
): Promise<Buffer> {
  const { doc, task } = await openDocument(data);
  try {
    const page = await doc.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      return canvas.toBuffer("image/png");
    } finally {
      await page.cleanup();
    }
  } finally {
    await closeDocument(task);
  }
}

/** Crop a rasterized PNG buffer to a normalized bounding box (0-1 coords). */
export function cropRaster(
  buffer: Buffer,
  bbox: { x: number; y: number; width: number; height: number },
): Buffer {
  const img = new Image();
  img.src = buffer;
  const w = img.width;
  const h = img.height;
  const x = Math.max(0, Math.round(bbox.x * w));
  const y = Math.max(0, Math.round(bbox.y * h));
  const cw = Math.max(1, Math.round(bbox.width * w));
  const ch = Math.max(1, Math.round(bbox.height * h));
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, x, y, cw, ch, 0, 0, cw, ch);
  return canvas.toBuffer("image/png");
}
