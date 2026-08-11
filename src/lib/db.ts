import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/quizforge";

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongooseCache: Cached | undefined;
}

const globalCache = (globalThis.__mongooseCache ??= {
  conn: null,
  promise: null,
});

export async function dbConnect(): Promise<typeof mongoose> {
  if (globalCache.conn) return globalCache.conn;

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

export function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}
