# Show a "Copied link" bottom drawer when a quiz link is copied

- Status: Open
- Branch: `feat/copy-link-drawer`

## Description

When the teacher copies a quiz's shareable link from the dashboard, a
bottom drawer should slide up confirming the copy, then dismiss itself
after a short delay.

## Context

`copyLink` in `src/components/QuizList.tsx:62` currently writes the URL to
the clipboard with no visual feedback. A reusable drawer component makes
the confirmation consistent and testable.

## Acceptance criteria

- [ ] Clicking "Copy link" on the dashboard shows a bottom drawer reading "Copied link" plus the copied URL.
- [ ] The drawer slides up from the bottom and auto-dismisses after ~2 seconds.
- [ ] The drawer uses `role="status"` / `aria-live` so screen readers announce it.
- [ ] Re-triggering a copy while visible resets the auto-dismiss timer.
- [ ] Clipboard failure (or missing `navigator.clipboard`) shows no drawer and does not throw.
- [ ] `npm run lint` and `npm run test:unit` pass.
