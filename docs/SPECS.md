# QuizForge — Project Specs

Project conventions, workflows, and verification commands for working in
this repository. opencode loads this file on startup via `instructions` in
`opencode.json`; it is also referenced from `AGENTS.md`.

## Overview

Next.js 16 (App Router) + TypeScript app that turns PDF textbook pages into
AI-generated quizzes (MongoDB + GridFS, iron-session auth, OpenAI). Read
`README.md` and `docs/database.md` for the big picture. Follow the
Next.js agent-rules block at the top of `AGENTS.md` — this Next version has
breaking changes; consult `node_modules/next/dist/docs/` before writing code.

## Verification commands (always run the relevant ones)

- `npm run lint` — ESLint. Must be clean (0 errors, no new warnings).
- `npm run test:unit` — pure logic tests (`tests/unit/`).
- `npm run test:dom` — component tests, jsdom + Testing Library (`tests/dom/`).
- `npm run test:integration` — full-stack API tests; **requires a running
  MongoDB on 127.0.0.1:27017** (a `mongodb` docker container) and boots the
  app on port 3313. Slow — run once per feature, not per tiny change.
- `npx tsc --noEmit` — typecheck when the change touches types.

After any change: run lint + the affected test suite(s). After a feature:
run all of unit + dom (+ integration when Mongo is available).

## TDD — hard rule

1. Write the failing test first (unit, DOM, or integration).
2. Run it and confirm it fails (red).
3. Implement the minimal code to make it pass.
4. Run it again and confirm it passes (green).
5. Keep tests small and focused per feature.

## Workflow — hard rule (every feature/fix)

1. Create a ticket in `tickets/NNN-short-name.md` (Status, Branch,
   Description, Context, Acceptance criteria) — see existing tickets.
2. Create a branch from `main`: `git checkout -b feat/<short-name>`.
3. Make **small commits**, each green and ideally paired with its tests.
4. When done, squash to `main`: `git checkout main && git merge --squash
   feat/<name>` then commit, verify, and push.
5. Delete the merged branch afterward (`git branch -D` after squash).
6. `git push origin main` only when the user asks.

Never commit secrets or `.env`.

## i18n conventions

- UI strings live in `src/locales/en.json` (identity: key == English value)
  and `src/locales/el.json` (Greek translations).
- **Every new string must be added to BOTH catalogs** with identical keys —
  the catalog-parity unit test fails otherwise.
- Use `useI18n()` (client) / `t()` and `serverT()` / `renderT()` (server);
  never hardcode user-facing text in JSX.
- Interpolate with `{var}` placeholders, e.g.
  `t("QuizList", "{count} questions · {minutes} min", { count, minutes })`.
- Server-side generation messages follow the `uiLang` field sent with the
  `/api/generate` request.

## Architecture pointers

- **Auth**: iron-session cookie; `SessionData = { userId }`; `userId` is
  `sha256(TEACHER_USERNAME)` via `deriveUserId()`. Teacher data is scoped by
  `ownerId` on `Quiz`/`Pdf` (`requireTeacher()` also adopts unowned docs).
- **DB**: collections `quizzes`, `pdfs`, `attempts` + GridFS `fs.files`/
  `fs.chunks`. Questions and answers are embedded. See `docs/database.md`.
- **Quiz video**: one optional `videoUrl` per quiz; strict validation via
  `youtubeUrlToEmbed()` (`src/lib/youtube.ts`); rendered at the top of the
  student quiz as a `youtube-nocookie.com` embed.
- **PDF pipeline**: `pdfjs-dist` + `@napi-rs/canvas` rasterize pages; the
  generate route streams SSE progress; the teacher's OpenAI key is encrypted
  client-side with a one-time AES key and never stored.
- Server components / `cookies()` / `headers()` are **async** in this Next
  version — `await` them.

## Code style

- No code comments unless the user asks for them.
- Match the surrounding style; follow existing patterns and libraries
  (Tailwind 4, zod, zustand, iron-session, mongoose).
- Do not add a new dependency without checking it isn't already in
  `package.json` and flagging why it's needed.
- Strict TypeScript; keep types explicit at module boundaries.
