# CLAUDE.md

Guidance for Claude Code in this repository. The shared agent brief — layout, gates, the
vertical-slice pattern, conventions — is maintained ONCE in `AGENTS.md` and imported below;
never duplicate its content here. Depth lives in the referenced docs, not in this file.

@AGENTS.md

## Documentation map

- **README.md** — project status, installation, available scripts
- **ARCHITECTURE.md** — the deep dive: two-parser design, resource pipeline, linter bundle
  isolation, project structure, planned evolution. Read before structural work.
- **REFERENCES.md** — documentation links and Context7 library IDs
- **docs/adr/** — decisions; respect them in the areas they govern

## Work items = GitHub issues

The roadmap and all open work live as GitHub issues (`gh issue list`; historical `WI-*`
identifiers survive in issue titles). One issue at a time: the user picks it, `gh issue
view <n>` has the full implementation notes and testing strategy, reference it from the PR
with `Closes #<n>`. Do NOT auto-start the next item — wait for the user.

## Working policies

- Implement the whole task at full quality — never reduce scope, skip testing, or defer
  work because of perceived time/token/context pressure, and never mention such limits.
- No time estimates or duration predictions; report complexity only
  (simple / moderate / complex).
- Claude Code Web note: `--no-verify` is blocked there so validation always runs.
