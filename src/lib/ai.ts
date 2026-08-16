import OpenAI from "openai";
import type { Difficulty, Question } from "@/lib/schemas";
import { questionSchema } from "@/lib/schemas";
import { serverT, type Locale } from "@/lib/i18n";

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
  locale: Locale = "en",
): Promise<ContentDigest> {
  progress(serverT(locale, "Generate", "Understanding content and figures…"));
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 3000,
    response_format: { type: "json_schema", json_schema: { name: "digest", strict: true, schema: DIGEST_SCHEMA } },
    messages: [
      {
        role: "system",
        content: serverT(locale, "Ai", "digestSystem"),
      },
      {
        role: "user",
        content: pageParts(pages),
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error(serverT(locale, "Generate", "Model returned no digest."));
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
  locale: Locale = "en",
): Promise<DraftQuestion[]> {
  const mixInstruction =
    opts.mix === "mc-tf-heavy"
      ? serverT(locale, "Ai", "questionsSystem4McTf")
      : serverT(locale, "Ai", "questionsSystem4Balanced");

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 6000,
    response_format: { type: "json_schema", json_schema: { name: "questions", strict: true, schema: QUESTIONS_SCHEMA } },
    messages: [
      {
        role: "system",
        content: [
          serverT(locale, "Ai", "questionsSystem1"),
          serverT(locale, "Ai", "questionsSystem2"),
          digest.language,
          serverT(locale, "Ai", "questionsSystem3"), opts.difficulty, ".",
          mixInstruction,
          serverT(locale, "Ai", "questionsSystem5"),
        ].join(" "),
      },
      {
        role: "user",
        content:
          serverT(locale, "Ai", "userTopicSummary", { topic: digest.topic, summary: digest.summary }) +
          serverT(locale, "Ai", "userKeyConcepts", { concepts: digest.keyConcepts.join("\n- ") }) +
          serverT(locale, "Ai", "userFigures", {
            figures: digest.figures
              .map((f) => `- page ${f.page}: "${f.label}" bbox=${JSON.stringify(f.bbox)}`)
              .join("\n"),
          }) +
          serverT(locale, "Ai", "userGenerate", { count: opts.questionCount }),
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error(serverT(locale, "Generate", "Model returned no questions."));

  const parsed = JSON.parse(raw) as { questions: DraftQuestion[] };
  const validated = parsed.questions.map((q) => ({
    ...questionSchema.parse(q),
    imageRef: q.imageRef ?? undefined,
  }));
  return validated.slice(0, opts.questionCount);
}
