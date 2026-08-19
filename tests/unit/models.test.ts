import { describe, expect, it } from "vitest";
import type { IndexDefinition } from "mongoose";
import { Quiz } from "@/lib/models/quiz";
import { Pdf } from "@/lib/models/pdf";

function hasIndexOn(
  model: { schema: { indexes: () => Array<[IndexDefinition, Record<string, unknown>]> } },
  field: string,
): boolean {
  return model.schema.indexes().some(([fields]) => field in fields);
}

describe("quiz model ownership", () => {
  it("exposes an optional, indexed ownerId path", () => {
    expect(Quiz.schema.path("ownerId")).toBeDefined();
    expect(Quiz.schema.path("ownerId")!.instance).toBe("String");
    expect(hasIndexOn(Quiz, "ownerId")).toBe(true);
  });
});

describe("pdf model ownership", () => {
  it("exposes an optional, indexed ownerId path", () => {
    expect(Pdf.schema.path("ownerId")).toBeDefined();
    expect(Pdf.schema.path("ownerId")!.instance).toBe("String");
    expect(hasIndexOn(Pdf, "ownerId")).toBe(true);
  });
});
