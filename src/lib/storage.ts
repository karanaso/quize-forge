import mongoose, { type Types } from "mongoose";
import type { GridFSBucketReadStream } from "mongodb";
import { dbConnect } from "@/lib/db";

function bucket() {
  if (!mongoose.connection.db) throw new Error("Not connected to MongoDB.");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db);
}

const BUFFER_OPTS: mongoose.mongo.GridFSBucketReadStreamOptions = {};

export async function uploadPdf(
  filename: string,
  originalName: string,
  data: Buffer,
): Promise<Types.ObjectId> {
  await dbConnect();
  const b = bucket();
  return new Promise((resolve, reject) => {
    const stream = b.openUploadStream(filename, { metadata: { kind: "pdf", originalName } });
    stream.end(data);
    stream.on("finish", () => resolve(stream.id as Types.ObjectId));
    stream.on("error", reject);
  });
}

export async function downloadFile(id: string | Types.ObjectId): Promise<Buffer> {
  await dbConnect();
  const b = bucket();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const stream = b.openDownloadStream(new mongoose.Types.ObjectId(String(id)), BUFFER_OPTS);
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function saveImage(data: Buffer, contentType = "image/png"): Promise<string> {
  await dbConnect();
  const b = bucket();
  return new Promise((resolve, reject) => {
    const stream = b.openUploadStream(`img-${Date.now()}.png`, { metadata: { kind: "question-image", contentType } });
    stream.end(data);
    stream.on("finish", () => resolve(stream.id.toString()));
    stream.on("error", reject);
  });
}

export async function streamImage(
  id: string,
  setHeaders: (headers: { contentType: string; length: number }) => void,
): Promise<GridFSBucketReadStream> {
  await dbConnect();
  const b = bucket();
  const _id = new mongoose.Types.ObjectId(id);
  const file = await b.find({ _id }).next();
  if (!file) throw new Error("Image not found");
  setHeaders({
    contentType: (file?.metadata?.contentType as string) ?? "image/png",
    length: file?.length ?? 0,
  });
  return b.openDownloadStream(_id, BUFFER_OPTS);
}
