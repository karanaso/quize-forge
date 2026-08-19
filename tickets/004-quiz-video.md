# Add an optional per-quiz YouTube video

- Status: Open
- Branch: `feat/quiz-video`

## Description

Teachers can attach one optional YouTube URL to a quiz. When present, the
video is embedded at the top of the student quiz-taking screen (above the
first question). There is **no skip button** — it is just part of the
form. When absent, nothing is shown.

## Context

- One `videoUrl` field on the `Quiz` document (not per question).
- Entered by the teacher in the QuizEditor header; validated strictly in
  the editor and again at the API.
- Strict validation: only `youtube.com/watch?v=ID` (incl. `www.`/`m.`) and
  `youtu.be/ID` are accepted; everything else is rejected.
- Rendered as a privacy-friendly embed: `https://www.youtube-nocookie.com/embed/ID`
  via `src/lib/youtube.ts` (`youtubeUrlToEmbed`), with `allowFullScreen`,
  no autoplay, responsive 16:9.
- An optional `t=`/`start=` timestamp is preserved as `?start=N`.

## Acceptance criteria

- [ ] `youtubeUrlToEmbed()` converts valid links and returns `null` otherwise (unit-tested).
- [ ] `Quiz` model and zod schemas carry an optional `videoUrl`.
- [ ] `PUT /api/quiz` rejects an invalid `videoUrl` with 400; accepts a valid one.
- [ ] QuizEditor shows a "YouTube video URL (optional)" input; invalid values show an inline error and are not saved.
- [ ] The public quiz payload includes `videoUrl`.
- [ ] StudentQuiz renders the embed at the top of the quiz when present, and nothing when absent.
- [ ] `npm run lint`, `npm run test:unit`, `npm run test:dom`, and `npm run test:integration` pass.
