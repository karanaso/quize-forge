import { describe, expect, it, vi } from "vitest";
import { extractDigest, draftQuestions } from "@/lib/ai";
import type { ContentDigest } from "@/lib/ai";
import type OpenAI from "openai";

interface FakeOpenAi {
  chat: {
    completions: {
      create: ReturnType<typeof vi.fn>;
    };
  };
}

function fakeClient(content: string): FakeOpenAi {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  };
}

function asOpenAi(client: FakeOpenAi): OpenAI {
  return client as unknown as OpenAI;
}

const progress = vi.fn();

describe("extractDigest", () => {
  it("parses a structured digest from the model", async () => {
    const digest: ContentDigest = {
      language: "English",
      topic: "Cells",
      summary: "A summary.",
      keyConcepts: ["Mitochondria", "Ribosomes"],
      figures: [{ page: 1, label: "diagram of a cell", bbox: { x: 0, y: 0, width: 0.5, height: 0.5 } }],
    };
    const client = fakeClient(JSON.stringify(digest));
    const result = await extractDigest(
      asOpenAi(client),
      [{ pageNumber: 1, raster: Buffer.from("fake-png") }],
      progress,
    );
    expect(result.topic).toBe("Cells");
    expect(result.figures).toHaveLength(1);
    expect(client.chat.completions.create).toHaveBeenCalled();
  });

  it("throws when the model returns no content", async () => {
    const client = fakeClient("");
    await expect(
      extractDigest(asOpenAi(client), [{ pageNumber: 1, raster: Buffer.from("x") }], progress),
    ).rejects.toThrow("no digest");
  });

  it("throws on invalid JSON", async () => {
    const client = fakeClient("not json");
    await expect(
      extractDigest(asOpenAi(client), [{ pageNumber: 1, raster: Buffer.from("x") }], progress),
    ).rejects.toThrow();
  });
});

describe("draftQuestions", () => {
  const digest: ContentDigest = {
    language: "English",
    topic: "Cells",
    summary: "Summary",
    keyConcepts: ["Mitochondria"],
    figures: [],
  };

  it("parses and defaults questions, keeping imageRef", async () => {
    const client = fakeClient(
      JSON.stringify({
        questions: [
          {
            kind: "mc",
            text: "What is the powerhouse?",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            explanation: "Mitochondria.",
            imageRef: { page: 1, label: "diagram of a cell" },
          },
          { kind: "tf", text: "True.", correct: false },
          {
            kind: "fill",
            text: "____ is the powerhouse.",
            blank: "mitochondria",
            acceptableAnswers: ["mitochondria"],
          },
        ],
      }),
    );

    const questions = await draftQuestions(asOpenAi(client), digest, {
      questionCount: 3,
      difficulty: "medium",
      mix: "balanced",
    });

    expect(questions).toHaveLength(3);
    expect(questions[0].kind).toBe("mc");
    expect(questions[0].imageRef).toEqual({ page: 1, label: "diagram of a cell" });
    expect(questions[1].explanation).toBe("");
    expect(questions[2].kind).toBe("fill");
  });

  it("caps the question list at questionCount", async () => {
    const client = fakeClient(
      JSON.stringify({
        questions: [
          { kind: "tf", text: "1", correct: true },
          { kind: "tf", text: "2", correct: true },
        ],
      }),
    );
    const questions = await draftQuestions(asOpenAi(client), digest, {
      questionCount: 1,
      difficulty: "easy",
      mix: "mc-tf-heavy",
    });
    expect(questions).toHaveLength(1);
  });

  it("throws when a question fails schema validation", async () => {
    const client = fakeClient(
      JSON.stringify({
        questions: [{ kind: "mc", text: "Missing options" }],
      }),
    );
    await expect(
      draftQuestions(asOpenAi(client), digest, {
        questionCount: 1,
        difficulty: "easy",
        mix: "balanced",
      }),
    ).rejects.toThrow();
  });
});
