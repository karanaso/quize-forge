import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";

export async function makeTestPdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`Test page ${p}`, {
      x: 50,
      y: 450,
      size: 16,
      font: helv,
      color: rgb(0, 0, 0),
    });
    if (p === 1) {
      const c = createCanvas(80, 60);
      c.getContext("2d").fillStyle = "#2266ff";
      c.getContext("2d").fillRect(0, 0, 80, 60);
      page.drawImage(await doc.embedPng(c.toBuffer("image/png")), {
        x: 200,
        y: 350,
        width: 100,
        height: 75,
      });
    }
  }
  return doc.save();
}

export function pdfFormData(
  bytes: Uint8Array,
  filename = "test.pdf",
): FormData {
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    filename,
  );
  return fd;
}
