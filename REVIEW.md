# Review

This file is the bar for a Claude review of a pull request. A finding that does not clear
it stays out of the review. One true finding is worth more than ten plausible ones.

## What to report

Report a defect that the change introduces and that CI does not catch:

- A wrong result: a parser, validator, decoder or renderer that produces a different value
  from the one Godot produces for the same `.tscn`.
- A crash, a hang, a leak or a lost error on a real input.
- A validator that rejects a scene Godot writes and loads. This is a false positive, and it
  is the most expensive bug in the linter.
- A bound without its engine `file:line` cite, or with a tier that does not match the
  three bound tiers in AGENTS.md.
- A broken convention from AGENTS.md that no guard enforces. Examples: a shared
  `THREE.Object3D` that is not cloned per consumer, or an engine fact copied into a slice
  instead of `src/godot/`.
- A security problem: an untrusted value in a shell command, a path that escapes its root,
  or a widened webview CSP.
- A test that cannot fail, or that asserts rendered geometry under happy-dom.

## What to skip

- Anything CI checks: ESLint, Prettier, `tsc`, `type-check:tests`, the conformance guards,
  `lint:scenes` and the golden images.
- Generated files, `pnpm-lock.yaml`, and the vendored `scenes/demos` and `scenes/isometric`.
- Files vendored from Verktøykasse: `.claude/rules/`, `.claude/skills/conventional-commits/`
  and `.claude/agents/ste-review.md`.
- Style, naming and wording preferences, unless the name states something false.
- Code that the change does not touch, unless the change makes it wrong.
- A finding you cannot tie to a concrete input. "This could fail" is not a finding.

## Severity

- 🔴 **Important**: a defect from "What to report". It should block the merge.
- 🟡 **Nit**: a real but small problem, such as a misleading comment. Post at most five.
  Give the count of the rest in the summary.
- 🟣 **Pre-existing**: a real defect in code the change touches but did not cause. Post at
  most two.

## Evidence

- Each finding names the input that triggers it and the wrong result it gives.
- A claim about Godot behaviour cites the engine source as `file:line`. A claim about this
  repository cites `file:line` here.
- Before you post a finding, read the code around it. Drop the finding if a guard, a test
  or a caller already handles the case.

## Comments

- Put each finding in one inline comment on the changed line. Start the comment with its
  severity emoji.
- Post one summary comment: the count of each severity, and one line for each Important
  finding. With no findings, the summary says so in one line.
- If the pull request already has a summary from an earlier Claude review, post Important
  findings only. A small fix does not earn a new round of nits.
- Write to the Simplified Technical English rules in `.claude/rules/ste-rules.md`.
