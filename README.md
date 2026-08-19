# QuizForge

Turn textbook PDFs into ready-to-use, AI-generated quizzes in seconds.

QuizForge is a Next.js app for teachers: upload a PDF of an educational
book, pick a page range and difficulty, and an AI reads the pages and
drafts a quiz strictly grounded in that content. Teachers review and
publish the quiz, share a student link, and get auto-graded results and
per-question analytics.

The UI is available in **English** and **Greek** (Ελληνικά) via a
dependency-free JSON locale system.

---

## Features

- **AI quiz generation from PDFs** — upload a PDF, select 1–10 pages and a
  difficulty; pages are rasterized and read by GPT-4o-mini, which extracts
  the key concepts and figures and drafts questions.
- **Question types** — multiple choice, true/false, fill-in-the-blank, and
  matching. Questions are grounded in the book: every answer and
  explanation cites the specific page it came from, and figure-based
  questions embed a cropped image of the relevant diagram.
- **Teacher workflow** — dashboard of quizzes, a 4-step creation wizard,
  a question editor (edit text/options/points/explanation), draft vs.
  published status, printable quiz + answer key, and per-quiz results.
- **Student experience** — public quiz link with school/class/name entry,
  configurable timer, question/option shuffling, playful sound effects
  (with a mute toggle), immediate feedback, and "other students answered"
  stats on the results screen.
- **Analytics** — per-question difficulty (best-attempt-per-student) and a
  per-student response modal showing each answer.
- **Secure by design** — the teacher's OpenAI API key is encrypted in the
  browser with a one-time server-issued key and is never stored.
- **i18n** — English + Greek locales stored as JSON, with a language
  toggle in the nav bar, login form, and student quiz header.

---

## Tech stack

| Layer      | Tech                                                        |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript               |
| Styling    | Tailwind CSS 4                                              |
| Database   | MongoDB via Mongoose, GridFS for PDFs and question images   |
| Auth       | iron-session (cookie) with a single teacher from env        |
| PDF        | pdfjs-dist + `@napi-rs/canvas` (rasterize & crop figures)   |
| AI         | OpenAI (`gpt-4o-mini`) with strict JSON-schema responses    |
| Validation | zod                                                         |
| State      | zustand (client stores)                                     |
| Tests      | Vitest (unit, jsdom, and integration projects)              |

---

## How it works

```
                        ┌──────────────────────────────────────────────┐
  Teacher uploads PDF   │  1. /api/pdf/upload   → store in GridFS      │
  + picks pages/options │  2. /api/generate     → SSE stream:          │
                        │       a. rasterize each page to PNG          │
                        │       b. extractDigest(): key concepts +     │
                        │          figure bounding boxes (GPT-4o-mini) │
                        │       c. draftQuestions(): quizzes grounded  │
                        │          in the digest, cropping figures     │
                        │  3. teacher edits & publishes (draft/published)
                        └──────────────────────────────────────────────┘
                                       │
                                        ▼
  Student opens /q/[quizId]  ───►  answers quiz (timer, shuffle, sounds)
                                       │
                                        ▼
  /api/attempt auto-grades  ───►  results + per-question stats
```

The OpenAI API key flow:

1. The browser asks the server for a short-lived one-time AES key
   (`/api/crypto-key`).
2. The teacher's API key is encrypted in the browser and sent with the
   generation request.
3. The server decrypts it in memory, uses it only for that generation,
   and never persists it.

---

## Getting started

### Prerequisites

- Node.js 20+ (Next.js 16 requirement)
- MongoDB 8 running locally — or use podman/Docker:

  ```bash
  podman run -d --name mongodb -p 27017:27017 \
    -v mongodb-data:/data/db docker.io/library/mongo:8
  ```

### Setup

```bash
npm install
cp .env.example .env    # then edit the values (see Environment variables)
npm run dev             # http://localhost:3000
```

Sign in with the `TEACHER_USERNAME` / `TEACHER_PASSWORD` from your `.env`,
then go to **+ New quiz** to upload a PDF and generate a quiz. You'll be
asked for an OpenAI API key in the wizard.

---

## Environment variables (`.env`)

Copy `.env.example` to `.env` and adjust. All variables are read from the
environment at runtime.

| Variable            | Required | Description                                                                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`       | Yes      | MongoDB connection string. Defaults to `mongodb://127.0.0.1:27017/quizforge`. Stores quizzes, attempts, PDFs and images. |
| `TEACHER_USERNAME`  | Yes      | Username for the single teacher account.                                                                                 |
| `TEACHER_PASSWORD`  | Yes      | Password for the teacher account.                                                                                        |
| `SESSION_SECRET`    | Yes      | Secret used to sign the teacher's session cookie. Must be at least 32 chars. Generate with `openssl rand -base64 32`.    |
| `APP_URL`           | No       | Base URL of the app (used for shareable links). Not currently read by the code; kept for future use / tooling.           |

Notes:

- **No `OPENAI_API_KEY` is needed in `.env`.** The teacher supplies their
  own key in the creation wizard for each generation; it is encrypted
  client-side with a one-time key and never stored.
- `SESSION_SECRET`, `TEACHER_USERNAME` and `TEACHER_PASSWORD` are loaded by
  `src/lib/auth.ts`; `MONGODB_URI` by `src/lib/db.ts`.
- Never commit your real `.env` — it is already in `.gitignore`.

---

## Scripts

| Script                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                             |
| `npm run build`       | Production build                                         |
| `npm run start`       | Start the production server                              |
| `npm run lint`        | ESLint                                                   |
| `npm test`            | Run all Vitest projects                                  |
| `npm run test:unit`   | Unit tests (node environment)                            |
| `npm run test:dom`    | Component tests (jsdom + Testing Library)                |
| `npm run test:integration` | End-to-end API tests (needs MongoDB + builds the app) |
| `npm run test:watch`  | Vitest watch mode                                        |

---

## Language support (i18n)

UI translations live in JSON files under `src/locales/`:

- `src/locales/en.json` — the source of truth. It maps each component
  (e.g. `QuizList`, `StudentQuiz`) to its UI strings (English → English).
- `src/locales/el.json` — the Greek translations for the same keys.

Language resolution order: **cookie** → **localStorage** → **browser
language** (Greek when it starts with `el`, else English). The `LangToggle`
pill (in the nav bar, login form, and quiz header) flips the language; the
choice is persisted and server-rendered text refreshes automatically.

Core modules:

- `src/lib/i18n.ts` — `t(locale, ns, key, vars?)` and `serverT(...)`, with
  English fallback and `{var}` interpolation.
- `src/stores/locale.ts` — zustand store + `useI18n()` hook.
- `src/lib/i18n-server.ts` — `getServerLocale()` / `renderT()` for server
  components and API routes.

Server-side strings are localized too: the quiz-generation progress/error
messages and the AI prompt instructions follow a `uiLang` field sent with
the generation request.

### Adding a new language

1. Copy `src/locales/en.json` to `src/locales/xx.json` and translate the
   values (keep every key identical).
2. Add `"xx"` to `Locale` / `LOCALES` in `src/lib/i18n.ts` and update
   `detectLocale()` in `src/stores/locale.ts`.
3. `npm run test:unit` — the catalog-parity test asserts `en` and `xx`
   define the same keys.

Quiz **content** (questions, explanations) is not translated: it stays in
the language of the source PDF, which the AI detects per quiz.

---

## Testing

```bash
npm run test:unit          # pure logic: schemas, grading, stats, ai, i18n, crypto, pdf
npm run test:dom           # UI: sticky header, copy-link drawer, language toggle
npm run test:integration   # full-stack API tests
```

Integration tests spin up their own stack: they drop the
`quizforge_test` database, `npm run build`, and boot the server on port
`3313` with test credentials. They require a running MongoDB and are slower
than the unit/DOM suites.

---

## Project structure

```
src/
  app/                  # Next.js App Router pages + API routes
    api/
      auth/             # teacher login / logout (iron-session)
      crypto-key/       # one-time AES key issuance
      generate/         # SSE quiz generation from a PDF
      pdf/upload/       # PDF upload -> GridFS
      quiz/             # quiz CRUD, public view, attempts, stats
      image/[id]/       # serves cropped question figures
    q/[quizId]/         # student quiz + results (public)
    quiz/[id]/          # teacher edit / results / print pages
  components/           # UI: wizard, editor, quiz runner, results, toggles
  lib/
    ai.ts               # OpenAI digest extraction + question drafting
    grading.ts          # automatic answer grading
    pdf.ts              # rasterize pages, crop figures (pdfjs + canvas)
    crypto.ts           # one-time AES-256-GCM key store
    client-crypto.ts    # browser-side encryption
    schemas.ts          # zod schemas (questions, quiz, attempts, requests)
    i18n.ts             # t()/serverT() translation helpers
    i18n-server.ts      # server-side locale resolution
    storage.ts          # GridFS upload/download for PDFs and images
    stats.ts            # best-attempt-per-student question stats
  locales/              # en.json + el.json translation catalogs
  stores/               # zustand stores (generator, editor, student, locale)
tests/
  unit/                 # node-environment logic tests
  dom/                  # jsdom component tests
  integration/          # full-stack API tests
tickets/                # feature tickets (markdown)
```

---

## License / status

Private project in active development. Not intended for production
deployment without adding rate limiting, storage quotas, and multi-teacher
auth as needed.
