# Archive — dated working artifacts

Phase-bound documents produced during specific work phases (R3F migration, hallway
verification, parity audits, architecture sprints). They are kept as historical
records and are **not maintained**: implementation pointers, line numbers, and
commit references inside them describe the repo as it was at the time of writing.

Living references stay in `docs/` (e.g. `PARITY-LIMITATIONS.md`, the user guides,
`user-flows.md`, and `docs/adr/`).

| File | Phase it came from | Status |
|------|--------------------|--------|
| `ARCH-CURATION-POST-MERGE.md` | Architecture sprint curation after the `feat/r3f-migration` merge (tip `05bd4d8`, 2026-05-27) | Historical record |
| `ARCH-IMPROVEMENT-CANDIDATES.md` | Accumulated arch-scout reports during the R3F migration sprints (2026-05) | Historical record |
| `ARCH-IMPROVEMENT-CANDIDATES-FINAL.md` | Final arch-scout sweep (tip `6a5cc44`, 2026-05-28) | Historical record |
| `ARCH-IMPROVEMENT-CANDIDATES-POST-MERGE.md` | Post-merge arch-scout sweep (tip `05bd4d8`, 2026-05-27) | Historical record |
| `ARCH-SCOUT-CURATION.md` | Curation of the 2026-05-20 arch-scout candidates for sprint dispatch | Historical record |
| `ARCHITECTURE-REVIEW.md` | Architecture review of the UX-regression WI cycle on `feat/r3f-migration` (`fc137e1`) | Historical record |
| `BUG-ARCHAEOLOGY-2026-05-28.md` | Investigation of test rewrites that masked regressions during the R3F migration | Historical record |
| `MAIN-FEATURE-INVENTORY.md` | Pre-migration baseline inventory of the vanilla-DOM app shell (`main` @ `80fa99e`) | Historical record (intentional snapshot — do not update) |
| `MAIN-VS-MIGRATION-DELTA.md` | Completeness gate comparing `main` vs `feat/r3f-migration` before the PR #48 merge (2026-05-20) | Historical record |
| `PARITY-AUDIT-POST-MERGE.md` | Godot-parity audit on the post-merge tip `05bd4d8` (2026-05-27) | Historical record |
| `PARITY-AUDIT-PROGRESS.md` | Batch tracker for the 2026-06-03 expanded parity audit (all batches completed; surviving divergences live in `docs/PARITY-LIMITATIONS.md`) | Historical record |
| `POST-MORTEM-WALL-REGRESSIONS.md` | Post-mortem on the hallway-fixture wall regressions (2026-05-28) | Historical record |
| `UX-FLOW-GAPS.md` | UX field run on `feat/r3f-migration` (`c771507`) that produced the WI-UX work items | Historical record |
| `UX-REGRESSIONS.md` | Cross-cutting UX-regression snapshot `main` vs `feat/r3f-migration` (all three regressions since resolved) | Historical record |
| `VISUAL-AB-MAIN-VS-MIGRATION.md` | Visual A/B screenshot comparison `main` @ `80fa99e` vs migration @ `2e065d5` (2026-05-20) | Historical record |
| `strict-checklists/` (13 files) | Strict-protocol verification runs of the web + VS Code user flows (executed 2026-05-19 against per-checklist commits) | Historical record |
| `test-plans/` (10 files) | Manual test plans and findings for the pre-R3F imperative web app and VS Code extension (`web-previewer/`, `vscode-extension/`, resource-loading plans); superseded by `docs/user-flows.md` and the strict checklists | Historical record |

## work_items/ — superseded and stub work-item material

Files moved out of `work_items/` during the roadmap normalization pass. The
`work_items/` directory itself (and the old `TODO.md`) has since been removed —
the live roadmap and all open work items now live as
[GitHub issues](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/issues),
with each former `WI-{number}.md` detail file's content preserved in its issue
body. The references to `work_items/WI-*.md` in the table below are historical.

| File | What it is | Status |
|------|-----------|--------|
| `ARCHITECTURE-DECISION-WI78.md` | Architecture decision notes for WI-78; decisions now live in `docs/adr/` | Historical record |
| `PHASE-13.5-ARCHITECTURE.md` | Phase 13.5 architecture plan (WI-78/WI-79/WI-77-revised), superseded by the Phase 14 R3F migration | Superseded |
| `PR-r3f-migration-body.md` | PR description artifact for the merged R3F migration PR | Historical record |
| `RESEARCH_GUIDE.md` | Research guide (Context7 queries, API mappings) for the original 30 work items, pre-R3F | Historical record |
| `SUMMARY.md` | Research and documentation summary for the original 30 work items | Historical record |
| `WI-57-implementation-plan.md` | Leftover implementation plan for the completed WI-57; `work_items/WI-57.md` remains the record | Historical record |
| `WI-77-revised.md` | Phase 13.5 multi-panel coordination item, superseded by `SelectionContext` in WI-R3F-4 | Superseded |
| `WI-80.md` | Multi-panel scene invalidation and node update spec, delivered differently by WI-R3F-5 | Superseded |
| `WI42.md` / `WI43.md` / `WI44.md` | Stub specs shadowing the full WI-42/WI-43/WI-44 detail files now in `work_items/` | Superseded stubs |
