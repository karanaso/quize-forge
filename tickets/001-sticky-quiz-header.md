# Fix sticky quiz header on the student quiz

- Status: Open
- Branch: `feat/sticky-quiz-header`

## Description

The header bar showing the quiz title, countdown timer, and mute toggle
should stay pinned to the top of the viewport while the student scrolls
through the questions.

## Context

The header in `src/components/StudentQuiz.tsx:396` already has
`sticky top-0 z-30`, but it does not actually stick. Its parent
`HappyBackdrop` (`src/components/StudentQuiz.tsx:174`) sets
`overflow-hidden`, which makes that ancestor the scroll container for the
sticky element. Because the container spans the full page height, the
header scrolls away with the content instead of sticking to the viewport.

The balloons are already clipped by their own `fixed inset-0
overflow-hidden` wrapper (`src/components/StudentQuiz.tsx:153`), so
removing `overflow-hidden` from `HappyBackdrop` must not introduce
horizontal overflow.

## Acceptance criteria

- [ ] The quiz header stays visible at the top while scrolling through questions.
- [ ] The countdown and mute button remain interactive while stuck.
- [ ] No horizontal scrollbar appears on `/q/[quizId]`.
- [ ] Balloons still animate and clip correctly during/after a quiz.
- [ ] `npm run lint` and `npm run test:unit` pass.
