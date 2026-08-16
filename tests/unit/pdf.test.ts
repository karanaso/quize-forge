import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { getPdfPageCount, rasterizePage, cropRaster } from "@/lib/pdf";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function makeTestPdf(withImage = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  for (let pageNum = 1; pageNum <= 2; pageNum++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`Page ${pageNum} content`, {
      x: 50,
      y: 450,
      size: 16,
      font: helv,
      color: rgb(0, 0, 0),
    });
    if (withImage && pageNum === 1) {
      const canvas = createCanvas(80, 60);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 80, 60);
      const png = canvas.toBuffer("image/png");
      const img = await doc.embedPng(png);
      page.drawImage(img, { x: 200, y: 350, width: 100, height: 75 });
    }
  }

  return doc.save();
}

describe("pdf lib", () => {
  it("counts pages of a valid PDF", async () => {
    const pdf = await makeTestPdf();
    const count = await getPdfPageCount(pdf);
    expect(count).toBe(2);
  });

  it("rasterizes a page to a PNG buffer", async () => {
    const pdf = await makeTestPdf();
    const png = await rasterizePage(pdf, 1);
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    expect(png.length).toBeGreaterThan(1000);
  });

  it("rasterizes page 2 as a different image", async () => {
    const pdf = await makeTestPdf();
    const p1 = await rasterizePage(pdf, 1);
    const p2 = await rasterizePage(pdf, 2);
    expect(Buffer.compare(p1, p2)).not.toBe(0);
  });

  it("crops a raster to a normalized bbox", async () => {
    const pdf = await makeTestPdf();
    const png = await rasterizePage(pdf, 1);
    const cropped = cropRaster(png, { x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
    expect(cropped.subarray(0, 8)).toEqual(PNG_MAGIC);
    expect(cropped.length).toBeGreaterThan(100);
  });

  it("clamps out-of-range crop boxes", async () => {
    const pdf = await makeTestPdf();
    const png = await rasterizePage(pdf, 1);
    const cropped = cropRaster(png, { x: -1, y: 0, width: 5, height: 5 });
    expect(cropped.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("rasterizes pages containing embedded images", async () => {
    const pdf = await makeTestPdf(true);
    const png = await rasterizePage(pdf, 1);
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    expect(png.length).toBeGreaterThan(1000);
  });
});
