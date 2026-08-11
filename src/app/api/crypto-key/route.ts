import { NextResponse } from "next/server";
import { createOneTimeKey } from "@/lib/crypto";

export async function POST() {
  return NextResponse.json(createOneTimeKey());
}
