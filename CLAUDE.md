# CLAUDE.md

@AGENTS.md

AGENTS.md (imported above) is the single agent brief — gates, slices, conventions live
there, never here.

## Docs

- README.md — status, install, scripts
- ARCHITECTURE.md — two-parser design, resource pipeline, linter bundle isolation,
  project structure. Read before structural work.
- REFERENCES.md — doc links, Context7 library IDs
- docs/adr/ — decisions; respect them in the areas they govern

## Work items = GitHub issues

`gh issue list`; historical `WI-*` ids survive in titles. One issue at a time, the user
picks it; `gh issue view <n>` has the implementation notes and testing strategy; reference
it from the PR with `Closes #<n>`; never auto-start the next item.

## Policies

- Full scope at full quality — never trim, skip tests, or defer for perceived
  time/token/context pressure; never mention such limits.
- No time estimates; report complexity only (simple / moderate / complex).
- Claude Code Web: `--no-verify` is blocked so validation always runs.
