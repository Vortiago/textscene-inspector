# Work Items

Detailed implementation notes for the TextScene Inspector roadmap in [TODO.md](../TODO.md).
TODO.md is the canonical index: each roadmap entry `#WI-{number}` links to its detail file
here as `work_items/WI-{number}.md`.

## Conventions

- **`WI-{number}.md`** — one file per work item. The number matches the `#WI-{number}`
  entry in TODO.md (TODO.md numbering is canonical).
- **`WI-{number}-{suffix}.md`** — companion files for a work item, e.g.
  `WI-63-research.md` (research report backing WI-63) and `WI-78-1.md`..`WI-78-6.md`
  (sub-items of WI-78).
- Completed items keep their detail files here as implementation records.
- Each detail file contains implementation steps, testing strategy, code examples,
  architecture decisions, and a complexity assessment.

## Non-WI references kept here

These files are not work items but are actively cited and must stay in this directory:

- **`PRD-r3f-migration.md`** — PRD for the Phase 14 R3F migration (linked from TODO.md
  and `docs/user-flows.md`)
- **`R3F-contracts.md`** — shared interface contracts for the R3F layer (cited from
  source files)
- **`SPIKE-r3f-migration.md`** — compatibility spike notes (referenced by the PRD)
- **`STRICT-VERIFICATION.md`** — strict verification protocol (cited by 10+ test files;
  do not move or rename)

## Archived material

Superseded plans, stubs, and one-off artifacts have moved to
[docs/archive/work_items/](../docs/archive/work_items/), indexed in
[docs/archive/README.md](../docs/archive/README.md). They are historical records and
are not maintained.

## Workflow

1. The user picks a work item from TODO.md.
2. Read the matching `WI-{number}.md` for implementation details and testing strategy.
3. Implement and test, then mark the TODO.md checkbox `[x]` immediately.
4. Do not auto-start the next item — wait for the user to specify.
