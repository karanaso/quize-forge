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
}

async function openDocument(data: Uint8Array) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data,
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

const ImageKind = {
  GRAYSCALE_1BPP: 1,
  RGB_24BPP: 2,
  RGBA_32BPP: 3,
  GRAYSCALE_8BPP: 4,
  GRAYSCALE_16BPP: 5,
  RGB_48BPP: 6,
  RGBA_64BPP: 7,
  GRAYSCALE_ALPHA_16BPP: 8,
  SMASK: 9,
  JPEG: 10,
  PNG: 11,
} as const;

interface PdfImage {
  kind: number;
  data: Uint8Array;
  width: number;
  height: number;
}

const OPS_PAINT_IMAGE_XOBJECT = 83;

/** Extract embedded raster images from a page, up to `max` images. */
export async function extractPageImages(
  data: Uint8Array,
  pageNumber: number,
  max = 12,
): Promise<Buffer[]> {
  const { doc, task } = await openDocument(data);
  try {
    const page = await doc.getPage(pageNumber);
    try {
      const opList = await page.getOperatorList();
      const images: Buffer[] = [];
      const seen = new Set<number>();
      const argsList = opList.argsArray;
      for (let i = 0; i < opList.fnArray.length; i++) {
        if (opList.fnArray[i] !== OPS_PAINT_IMAGE_XOBJECT) continue;
        if (images.length >= max) break;
        const objId = argsList[i]?.[0] as number | undefined;
        if (objId === undefined || seen.has(objId)) continue;
        seen.add(objId);

        const img = (await page.objs.get(String(objId))) as PdfImage | null;
        if (!img || !img.data || !img.width || !img.height) continue;

        if (img.kind === ImageKind.JPEG || img.kind === ImageKind.PNG) {
          images.push(Buffer.from(img.data));
        } else {
          const c = createCanvas(img.width, img.height);
          const ctx = c.getContext("2d");
          const imageData = new ImageData(
            new Uint8ClampedArray(img.data.buffer as ArrayBuffer),
            img.width,
            img.height,
          );
          ctx.putImageData(imageData, 0, 0);
          images.push(c.toBuffer("image/png"));
        }
      }
      return images;
    } finally {
      await page.cleanup();
    }
  } finally {
    await closeDocument(task);
  }
}
