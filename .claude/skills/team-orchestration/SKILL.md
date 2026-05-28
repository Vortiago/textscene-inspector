---
name: team-orchestration
description: Patterns and antipatterns for running a team of long-lived agent teammates (TeamCreate + named teammates) on a multi-WI implementation goal with parallel work and verification.
when_to_use: When the user requests a team-of-agents workflow with persistent named roles (architect, implementer, verifier, etc.) — not one-shot subagents. Especially when the work spans multiple parallel WIs with cross-cutting verification.
---

# Team orchestration — lessons

## Roles to spawn (and the right tool kit per role)

- **architect** — designs contracts, PRD edits, sanity-pass documents. Use a read-mostly subagent type (no Bash). Keeps them out of code accidentally.
- **implementer(s)** — write code. `general-purpose` (full tools incl. Bash). One implementer for sequential WIs; spawn additional named implementers (`impl-nodes`, `impl-ui`, etc.) for genuinely parallel WIs.
- **verifier(s)** — drive the running app, take screenshots, write user guides. One per host environment (browser, IDE). `general-purpose` with whatever MCP browser tools are available.
- **flow-director** (optional, useful) — writes the user-flow scenarios verifiers execute. Independent of implementation pace; can ship its deliverable in parallel.

Spawn each as a persistent teammate via `Agent(team_name=..., name=...)`, not as one-shot subagents. Brief each with a "load context then send team-lead a ready message; do not act on auto-dispatched tasks" prologue.

## Coordination antipatterns (we hit these; you will too)

1. **Concurrent pnpm processes corrupt the workspace.** If two teammates run `pnpm install` / `pnpm build` / `pnpm dev` simultaneously in the same monorepo, dist/ and node_modules/ race. Symptom: dev server falls back to "legacy" code path because Vite restart fails to resolve modules. **Serialize.** Tell teammates to teardown their dev hosts and run scripts before another teammate starts pnpm work.

2. **`task-list` auto-dispatcher misroutes.** Leftover stale teammates from prior `/goal` sessions persist in the team's `config.json` (can't be deleted individually — only `TeamDelete` nukes everything). The auto-coordinator pings idle teammates with any open task, regardless of role. Brief every new teammate: **"Ignore all task-list messages. Only act on direct SendMessage from team-lead."**

3. **Messages cross in transit.** SendMessage is async. A teammate can be replying to message N while you send message N+1; their reply arrives looking out-of-context. Always include the dispatch's commit SHA or WI number so they can resolve which task each message refers to.

4. **Worktree paths on Windows hit MAX_PATH (260 chars).** Vitest's chunked imports fail at long paths even when source code is fine. If a teammate works in `.claude/worktrees/feat-<long-name>/`, `pnpm test` will fail with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. Either use shorter worktree dir names (`.claude/wt/r3f/`) or work from the main checkout.

5. **Idle notifications ≠ stuck.** A teammate may idle several times during one work session. Don't ping at the first idle — wait for a real signal of stuck (no commit on origin after ~15 min past dispatch). When you do ping, ask for a one-line status, not detailed prose.

6. **Trust but verify.** When a teammate reports "all green / X tests pass / file written", grep/wc/git-show to confirm the file contents match the claim. Reports describe intent; reality lives on disk.

7. **Silent test deletions during a migration eat your regression coverage.** During the TextScene R3F migration, 30+ test files (~3000 lines) were removed across WIs with no replacement — including the exact tests that would have caught a matrix transpose bug, a PlaneMesh face-culling default change, and a nested PackedScene composition bug. The bugs survived months until the user noticed visually. **Rule for migrations:** any PR that removes test files must state for each, one of: "code under test removed; assertions no longer reachable" / "replaced by `<path>` covering the same invariant" / "asserted behaviour changed deliberately; new test at `<path>`". A PR removing tests with no replacement and no surface change is a regression-guard removal, reviewed as such — not as test cleanup.

8. **Tests rewritten to assert buggy output are the textbook anti-pattern.** Symptom: a commit titled "close N canary feature-misses" (or similar) that flips assertion values to match what the new code outputs, often with a rationalising comment ("the user's intent isn't recoverable", "TRS ambiguity is unavoidable", "this is the actual output"). In the TextScene incident, `b4ccaab` rewrote a `decomposeTransform3D` test from `scale.z = 6` to `scale.x = 6` — the second value matched the buggy code, but a clean re-derivation from Godot's source (`Basis::xform` uses `rows[i].dot(v)`) shows the first was correct. **Rule:** any PR changing a test assertion VALUE (not adding/removing tests) must explicitly state in the body that the change is "fixing the test to match a known-correct code change" with reference to the spec/source, OR "fixing the test to no longer assert a regression that was just introduced" with reference to the original commit. Comments in test code that rationalise away the discrepancy are a signal to stop and reconsider the CODE, not the test.

9. **Verifier preflight before declaring FAIL on a fix.** A verifier ran a numerical probe against a transform-decompose fix, got results that matched the OLD buggy code, declared FAIL — the probe had been written against the buggy code's interpretation, not against the upstream spec. **Rule:** before marking a fix as FAILed, verifier must (a) re-derive the expected output from the upstream spec/source/fixture (not from running either the old or new code), (b) run the affected unit tests on the fix branch and report pass/fail counts, (c) run at least one numerical probe matching (a)'s expected. If all three support the fix and the visual check disagrees, the visual check is suspect (Vite cache / browser cache / wrong branch / wrong build) — halt and confirm the build pipeline before issuing a FAIL.

10. **Implementer defence-of-analysis loop.** When a team-lead pushes back on an implementer's diagnosis with a concrete reference (a commit hash, a test, a spec passage), the implementer's next message must ENGAGE the reference directly — agree, refute with equally concrete evidence, or ask for clarification. Continuing to defend the original analysis with new analysis ("here's another angle on why my position is correct") is the pattern that ate two dispatch cycles in the TextScene wall incident. **Rule:** if a team-lead's pushback includes a `git show <sha>` or a path to a test, the implementer's reply must quote-and-respond to it, not deflect.

11. **Vite-predev build-once gotcha (TextScene-specific but recurs in any pnpm-workspace + Vite setup).** `apps/textscene-web/package.json`'s `predev` script runs `pnpm --filter @textscene/core build` ONCE at dev-server startup. Source edits to `packages/textscene-core/src/` do NOT propagate to the running dev server until core is rebuilt; Vite HMR sees no change because `@textscene/core` resolves to `dist/`. During the wall-side-fix incident, a MaterialSlot fix was correct in source for ~5 minutes before being delivered to the browser, producing a false "the fix doesn't work" reading and one wasted teammate cycle. **Rule:** after editing any source under `packages/textscene-core/src/`, either kill+restart the dev server, OR run `pnpm --filter @textscene/core build` manually, then hard-refresh the browser. If Vite's dep-optimization cache also seems sticky, restart with `--force`.

## Verification protocol

This is the part that's hardest to get right and easiest to get wrong.

**Verifiers must NOT mark a flow PASS based on "renders without errors".** That misses silent feature-misses (a property gets parsed but never applied to the THREE primitive; a chain of references resolves but the result is dropped).

**Two-layer verification:**

- **Layer 1: per-property regression tests** — for every feature property the renderer claims to support, a vitest+test-renderer test that asserts the specific THREE primitive property has the expected value (e.g., `texture.repeat.x === 2` when `uv1_scale=Vector3(2,2,1)`). These belong in `src/`, run in CI. Inventory them upfront.

- **Layer 2: strict-protocol verifier checklists** — for each user flow, a per-property table in `docs/strict-checklists/<flow>.md` with concrete expected values, verification methods, and a `PASS/FAIL/CANT-VERIFY` column. **The killer assertion: when a fixture exercises VARIATIONS of a property (e.g., three planes with different uv_scale), include a row that asserts the outputs are pairwise distinct.** Without that row, identical-looking-because-broken renders PASS.

- **`it.fails()` canary wrapping** — when regression tests are added before fixes land, wrap known-broken tests in `it.fails('...', ...)` with an inline `// EXPECTED-FAIL` comment. Pre-commit stays green; `git grep EXPECTED-FAIL` is the auditable bug inventory. When fixes land, the wrappers must be removed (the test now passes, which makes `it.fails` actually fail).

## Process for an implementation + verification cycle

1. **Spawn the team** with wait-for-explicit-assignment briefs. Don't dispatch real work until all teammates report ready.
2. **Architect drafts contracts first** if parallel implementers will collide on shared types. Saves rework.
3. **Property inventory + regression tests** before claiming any feature is "done". Surface silent misses early.
4. **Implementer commits incrementally**, pushes after each WI. Don't batch multiple WIs into one commit.
5. **Verifiers prove the strict protocol on a paper checklist** (desk-run on one fixture) before doing a real run. Catches verifier methodology drift.
6. **Field-execute the strict checklist.** Any FAIL halts the verifier; don't silently retry.
7. **Diagnostic, then fix WI.** When a FAIL surfaces, dispatch a targeted fix WI that includes adding the regression test for that specific failure path.
8. **Re-verify with the same checklist.** Same row that FAILed must now PASS.
9. **Open the PR only after all checklists pass.** Final PR description includes pointers to user guides + canary inventory at zero.

## Things to put in MEMORY.md after a successful run

- The team name + the surviving teammates (so a future session can wake them with SendMessage rather than respawn).
- Which agent types each teammate role used (helps future spawns).
- Project-specific gotchas discovered (e.g., "vitest under .claude/worktrees/ exceeds Windows MAX_PATH — use a shorter dir").

## Things NOT to do

- Don't spawn one-shot subagents via `Agent({})` when the user asked for a team. They're not addressable by SendMessage and can't be re-engaged.
- Don't `--no-verify` git commits unless the user has explicitly authorized it for a specific environmental block (e.g., Windows MAX_PATH). Document the block in the commit message.
- Don't let verifiers say "looks fine" without a concrete per-property assertion. Reject vague reports and ask for specific observed values.
- Don't merge a PR with `it.fails()`-wrapped tests still present. The inventory must be at zero.
