# Review

Report only findings that clear this bar.

## What to report

A defect the change introduces and CI does not catch:

- A value that differs from Godot's for the same `.tscn`.
- A crash, hang, leak or lost error on a real input.
- A validator that rejects a scene Godot writes and loads.
- A bound without its engine `file:line` cite, or with the wrong tier (AGENTS.md).
- A broken AGENTS.md convention that no guard enforces.
- An untrusted value in a shell command, a path that escapes its root, or a widened webview CSP.
- A test that cannot fail, or that asserts rendered geometry under happy-dom.

## What to skip

- Anything CI checks: ESLint, Prettier, `tsc`, `type-check:tests`, the conformance guards, `lint:scenes` and the golden images.
- Generated files, `pnpm-lock.yaml`, `scenes/demos` and `scenes/isometric`.
- `.claude/rules/`, `.claude/skills/conventional-commits/` and `.claude/agents/ste-review.md`.
- Style and naming, unless a name states something false.
- Untouched code, unless the change makes it wrong.
- A finding without a concrete input.

## Severity

- 🔴 **Important**: a defect from "What to report". It blocks the merge.
- 🟡 **Nit**: a small real problem. Report at most five, and count the rest in the summary.
- 🟣 **Pre-existing**: a defect in touched code that the change did not cause. Report at most two.

## Evidence

- Name the triggering input and the wrong result.
- Cite every claim as a `file:line`, in the engine or here.
- Drop a finding that a guard, a test or a caller already handles.

## Answer

- Give each finding its file, a line the diff shows, its severity and its text, without the emoji.
- Give one summary: the count per severity, and one line per Important finding.
- If a summary headed "Claude review" already exists, report Important findings only.
- Write to `.claude/rules/ste-rules.md`.
