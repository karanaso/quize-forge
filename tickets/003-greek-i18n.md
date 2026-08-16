# Add Greek (el) language support via JSON locales

- Status: Open
- Branch: `feat/i18n-greek`

## Description

Make the whole app UI switchable between English and Greek using a
lightweight, dependency-free JSON translation system. No i18n library.

## Design

- Locale JSON lives in `src/locales/en.json` (identity map) and
  `src/locales/el.json` (Greek translations), shaped per component
  filename, e.g. `{ "QuizList": { "Copy link": "Αντιγραφή συνδέσμου" } }`.
  Shared strings live under a `Common` namespace; server messages under
  `Api` / `Ai`.
- `src/lib/i18n.ts` exposes:
  - `t(locale, ns, key, vars?)` — pure lookup, falls back to English then
    to the raw key, supports `{var}` interpolation.
  - `useI18n()` — client hook backed by a locale store.
  - `serverT(locale, ns, key, vars?)` — for API routes / SSE.
- `src/stores/locale.ts` — zustand store: default from
  `navigator.language` when it starts with `el`, else English; persisted in
  `localStorage`.
- `src/components/LangToggle.tsx` — small EN/EL pill shown in the NavBar,
  the login form, and the student quiz header (next to mute).
- The generate request sends a `uiLang` field; the SSE progress/error
  messages and the AI prompt instructions are translated server-side.
- Quiz *content* (questions, explanations) stays in the language of the
  book PDF — the UI language is separate.

## Acceptance criteria

- [ ] All hardcoded UI strings across teacher and student screens are translated.
- [ ] Selecting Greek flips the entire UI; the choice persists across reloads.
- [ ] Language defaults from the browser locale when no preference is stored.
- [ ] Generate progress/error messages and AI instructions render in the requested language.
- [ ] Missing keys fall back to English (never blank), and `{var}` interpolation works.
- [ ] Unit tests cover `t()`, fallback, interpolation, and locale detection.
- [ ] `npm run lint` and `npm run test:unit` pass.
