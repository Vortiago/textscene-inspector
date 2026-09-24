# CLAUDE.md

@AGENTS.md

AGENTS.md (imported above) is the single agent brief. Gates, slices and conventions live
there, never here.

## Docs

- README.md: status, install, scripts.
- ARCHITECTURE.md: two-parser design, resource pipeline, linter bundle isolation,
  project structure. Read it before structural work.
- REFERENCES.md: doc links, Context7 library IDs.
- docs/adr/: decisions. Respect them in the areas they govern.

## Work items = GitHub issues

- `gh issue list` lists them. Old `WI-*` ids stay in some titles.
- Do one issue at a time. The user picks it.
- `gh issue view <n>` has the implementation notes and testing strategy.
- Reference the issue from the PR with `Closes #<n>`.
- Never start the next item on your own.

## Policies

- Full scope at full quality: never trim, skip tests, or defer for perceived
  time, token or context pressure. Never mention such limits.
- No time estimates. Report complexity only (simple / moderate / complex).
- Claude Code: `.claude/hooks/check-no-verify.mjs` blocks `git commit --no-verify` and `-n`,
  so the pre-commit checks always run.
