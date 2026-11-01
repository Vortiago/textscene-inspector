---
name: pr-description
description: The description a pull request of this repository carries: its shape, its grounding, its numbers and the goldens disposition. Use when opening, editing or reviewing a PR body here, or when someone asks for a better PR description.
---

# PR descriptions

A PR body reports changed behaviour and the numbers that check it. Squash-merge turns the title
into the commit subject and the body into its message, so the title's type and severity come from
the `conventional-commits` skill and the body never restates them.

## Shape

1. Open with `## What changes` (the template's spelling): bullets of what changed and why, each
   claim grounded in an engine `file:line` cite or an engine fact already on the page. No restated
   title.
2. Then `## How you checked it`: bullets of evidence. A measurement-led fix may use `## Measured`
   and open with two prose paragraphs instead.
3. End with `Closes #n`, or nothing when the work has no issue.

An ordinary fix runs 12–22 lines; a cross-workspace feature may run longer, one topic per bullet.

## Every body carries

- Numeric evidence with real outputs: named commands (`pnpm ref:diff <scene>`, `pnpm test:visual`),
  counts (`587/587 scenes`, `1097 passed`), and before-to-after pairs (`0.419 to 0.402`). Measure,
  never derive: the numbers sit in the PR, never only in a comparison sheet.
- The golden disposition: which goldens move or stay byte-equal, named by key, with the reason of a
  recapture.
- A cause for every residual difference; where a number stays, the acceptance that lets it.
- The touched artefacts in prose: fixtures, allowlist, comparison sheet, ADR or README updates.
- Follow-ups as `Follow-ups: #n <why>`, when they exist.

## Never

- No checklists, changelog, release notes, diffstat, CI-run links, embedded images or video: the
  Goldens workflow attaches its own diffs as a comment, and the body states their disposition only.
- No scope-trimming, alternatives-considered or time notes.
- STE applies: British English, full verb forms, no em dashes, at most 25 words in a sentence.