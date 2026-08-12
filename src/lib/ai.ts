import OpenAI from "openai";
import type { Difficulty, Question } from "@/lib/schemas";
import { questionSchema } from "@/lib/schemas";

export interface PageContent {
  pageNumber: number;
  raster: Buffer;
}

export interface FigureRef {
  page: number;
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface ContentDigest {
  language: string;
  topic: string;
  summary: string;
  keyConcepts: string[];
  figures: FigureRef[];
}

export type ProgressFn = (message: string) => void;

const DIGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["language", "topic", "summary", "keyConcepts", "figures"],
  properties: {
    language: { type: "string", description: "Human language the book text is written in, e.g. 'English'." },
    topic: { type: "string" },
    summary: { type: "string", description: "2-3 sentence summary of the pages." },
    keyConcepts: {
      type: "array",
      items: { type: "string" },
      description: "Key concepts, terms, definitions and facts a student should know.",
    },
    figures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "label", "bbox"],
        properties: {
          page: { type: "integer", minimum: 1 },
          label: { type: "string", description: "Short label describing the figure, e.g. 'diagram of a cell'." },
          bbox: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 1 },
              y: { type: "number", minimum: 0, maximum: 1 },
              width: { type: "number", minimum: 0, maximum: 1 },
              height: { type: "number", minimum: 0, maximum: 1 },
            },
            description: "Normalized (0-1) bounding box of the figure on its page.",
          },
        },
      },
    },
  },
};

const IMAGE_REF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["page", "label"],
  properties: {
    page: { type: "integer", minimum: 1 },
    label: {
      type: "string",
      description: "Must match a figure label from the digest exactly.",
    },
  },
};

// OpenAI strict mode requires `required` to list every key in `properties`,
// so each question kind gets its own self-contained schema and the items use
// `anyOf` to discriminate on `kind`.
const MC_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text", "options", "correctIndex", "explanation", "imageRef"],
  properties: {
    kind: { type: "string", const: "mc" },
    text: { type: "string" },
    options: {
      type: "array",
      items: { type: "string" },
      minItems: 4,
      maxItems: 4,
      description: "Exactly 4 options for a multiple-choice question.",
    },
    correctIndex: {
      type: "integer",
      minimum: 0,
      maximum: 3,
      description: "Index of the correct option (0-3).",
    },
    explanation: { type: "string", description: "Short explanation of the correct answer." },
    imageRef: {
      ...IMAGE_REF_SCHEMA,
      type: ["object", "null"],
      description: "Optional. Reference a figure from the digest when the question depends on it.",
    },
  },
};

const TF_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text", "correct", "explanation", "imageRef"],
  properties: {
    kind: { type: "string", const: "tf" },
    text: { type: "string" },
    correct: { type: "boolean", description: "The correct true/false value." },
    explanation: { type: "string", description: "Short explanation of the correct answer." },
    imageRef: {
      ...IMAGE_REF_SCHEMA,
      type: ["object", "null"],
      description: "Optional. Reference a figure from the digest when the question depends on it.",
    },
  },
};

const FILL_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text", "blank", "acceptableAnswers", "explanation", "imageRef"],
  properties: {
    kind: { type: "string", const: "fill" },
    text: { type: "string", description: 'The sentence with "____" where the blank is.' },
    blank: { type: "string", description: "The exact missing word/phrase." },
    acceptableAnswers: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
      description: "The blank answer plus obvious alternative phrasings.",
    },
    explanation: { type: "string", description: "Short explanation of the correct answer." },
    imageRef: {
      ...IMAGE_REF_SCHEMA,
      type: ["object", "null"],
      description: "Optional. Reference a figure from the digest when the question depends on it.",
    },
  },
};

const MATCHING_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text", "pairs", "explanation", "imageRef"],
  properties: {
    kind: { type: "string", const: "matching" },
    text: { type: "string", description: "Optional instruction text for the matching question." },
    pairs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["left", "right"],
        properties: {
          left: { type: "string", description: "Term to be matched." },
          right: { type: "string", description: "The matching definition." },
        },
      },
      minItems: 2,
      maxItems: 8,
      description: "Term->definition pairs. Use left=term, right=definition.",
    },
    explanation: { type: "string", description: "Short explanation of the correct answer." },
    imageRef: {
      ...IMAGE_REF_SCHEMA,
      type: ["object", "null"],
      description: "Optional. Reference a figure from the digest when the question depends on it.",
    },
  },
};

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        anyOf: [MC_ITEM_SCHEMA, TF_ITEM_SCHEMA, FILL_ITEM_SCHEMA, MATCHING_ITEM_SCHEMA],
      },
    },
  },
};

export function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function pageParts(pages: PageContent[]): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  return pages.flatMap((p) => [
    {
      type: "text" as const,
      text: `--- Page ${p.pageNumber} (image below) ---`,
    },
    {
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${p.raster.toString("base64")}` },
    },
  ]);
}

export async function extractDigest(
  client: OpenAI,
  pages: PageContent[],
  progress: ProgressFn,
): Promise<ContentDigest> {
  progress("Extracting key concepts and figures…");
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 3000,
    response_format: { type: "json_schema", json_schema: { name: "digest", strict: true, schema: DIGEST_SCHEMA } },
    messages: [
      {
        role: "system",
        content:
          "You are reading pages of an educational book (text plus figures/diagrams). " +
          "Extract ONLY what is actually printed on these pages — do not add any outside knowledge. " +
          "List every important fact, definition, formula, example, term and number exactly as it appears in the book, " +
          "each as a key concept that includes its exact page number, e.g. \"C = 2\u03c0r is the circumference formula (p. 4)\". " +
          "Also produce a catalog of the figures on each page with their normalized bounding boxes " +
          "(x/y/width/height in 0-1 coordinates relative to the page).",
      },
      {
        role: "user",
        content: pageParts(pages),
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Model returned no digest.");
  return JSON.parse(raw) as ContentDigest;
}

export type DraftQuestion = Question & {
  imageRef?: { page: number; label: string };
};

export async function draftQuestions(
  client: OpenAI,
  digest: ContentDigest,
  opts: {
    questionCount: number;
    difficulty: Difficulty;
    mix: "balanced" | "mc-tf-heavy";
  },
): Promise<DraftQuestion[]> {
  const mixInstruction =
    opts.mix === "mc-tf-heavy"
      ? "Make roughly 80% multiple-choice and true/false questions; the remainder can be fill-in-the-blank or matching."
      : "Balance multiple-choice, true/false, fill-in-the-blank and matching questions evenly.";

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 6000,
    response_format: { type: "json_schema", json_schema: { name: "questions", strict: true, schema: QUESTIONS_SCHEMA } },
    messages: [
      {
        role: "system",
        content: [
          "You are a teacher writing a quiz that tests ONLY the material in the provided book pages. ",
          "Write the questions in this language: ",
          digest.language,
          ".",
          "Question difficulty:", opts.difficulty,
          ". ",
          mixInstruction,
          "",
          "Every question must be directly and exclusively answerable from the supplied pages. ",
          "Never invent facts, formulas, dates, examples or numbers that are not in the book. ",
          "Use the book's own terminology, definitions, formulas and examples. ",
          "In each explanation, name the specific concept from the book and include its page number, ",
          'e.g. "From p. 4: the circumference formula C = 2\u03c0r.". ',
          "When a question depends on a figure/diagram, set imageRef to match a figure label from the digest exactly.",
        ].join(" "),
      },
      {
        role: "user",
        content:
          `Book topic: ${digest.topic}\nSummary: ${digest.summary}\n` +
          `Key concepts (facts from the book, with page numbers):\n- ${digest.keyConcepts.join("\n- ")}\n` +
          `Figures:\n${digest.figures
            .map((f) => `- page ${f.page}: "${f.label}" bbox=${JSON.stringify(f.bbox)}`)
            .join("\n")}\n` +
          `\nGenerate exactly ${opts.questionCount} questions, each grounded in a concrete fact, formula, definition or example from the pages above. ` +
          `Fill-in-the-blank: put "____" in the text where the blank is.`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Model returned no questions.");

  const parsed = JSON.parse(raw) as { questions: DraftQuestion[] };
  const validated = parsed.questions.map((q) => ({
    ...questionSchema.parse(q),
    imageRef: q.imageRef ?? undefined,
  }));
  return validated.slice(0, opts.questionCount);
}
