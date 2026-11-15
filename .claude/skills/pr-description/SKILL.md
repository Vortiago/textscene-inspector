---
name: pr-description
description: The description a pull request of this repository carries: its shape, its grounding, its numbers, the goldens disposition and the reader's verification commands. Use when opening, editing or reviewing a PR body here, or when someone asks for a better PR description.
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
3. Then `## How you can verify it`: the reader's commands, run from a fresh checkout, one expected
   outcome each. Only commands this repository's own scripts run, that read no secret, and that
   state one thing the body's evidence does not already answer.
4. After a Claude review, `## Review findings`: a table with one short row for each comment the
   review left on the PR, and what was done with it (the fix commit, the owning issue, or
   "declined" with the reason). No row for a local review run. With no comment, one line that names
   the head the review read.
5. End with `Closes #n`, or nothing when the work has no issue.

An ordinary fix runs 12–22 lines; a cross-workspace feature may run longer, one topic per bullet.

## Every body carries

- Numeric evidence with real outputs: named commands (`pnpm ref:diff <scene>`, `pnpm test:visual`),
  counts (`587/587 scenes`, `1097 passed`), and before-to-after pairs (`0.419 to 0.402`). Measure,
  never derive: the numbers sit in the PR, never only in a comparison sheet.
- For a rendering change, a refactor included, the measurement against Godot first: what got
  closer, what is still off and the issue that owns it.
- The golden disposition, after the measurement: which goldens move or stay byte-equal, named by
  key, with the reason of a recapture. An unmoved golden is no measurement against Godot.
- A cause for every residual difference; where a number stays, the acceptance that lets it.
- The touched artefacts in prose: fixtures, allowlist, comparison sheet, ADR or README updates.
- Follow-ups as `Follow-ups: #n <why>`, when they exist. Each part of the issue that the PR leaves
  out is one, with its owning issue.

## Never

- No checklists, changelog, release notes, diffstat, CI-run links, embedded images or video: the
  Goldens workflow attaches its own diffs as a comment, and the body states their disposition only.
- No alternatives-considered or time notes, and no scope cut without its owning issue.
- STE applies: British English, full verb forms, no em dashes, at most 25 words in a sentence.