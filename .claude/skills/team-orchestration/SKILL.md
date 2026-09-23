---
name: team-orchestration
description: Patterns and antipatterns for running a team of long-lived agent teammates (TeamCreate + named teammates) on a multi-WI implementation goal with parallel work and verification.
when_to_use: When the user requests a team-of-agents workflow with persistent named roles (architect, implementer, verifier, etc.) — not one-shot subagents. Especially when the work spans multiple parallel WIs with cross-cutting verification.
---

# Team orchestration

These are the rules for a team of persistent, named agent teammates that implement and verify several work items in parallel.

## Roles and their tools

- **architect**: designs contracts, edits the PRD, reviews documents. Use a read-mostly subagent type (no Bash), so it cannot change code by accident.
- **implementers**: write code. Use `general-purpose` (all tools, Bash included). One implementer for sequential work items. For parallel work items, spawn more named implementers (`impl-nodes`, `impl-ui`, and so on).
- **verifiers**: drive the running app, take screenshots and write user guides. One per host environment (browser, IDE). Use `general-purpose` with the available MCP browser tools.
- **flow-director** (optional): writes the user-flow scenarios the verifiers run. It works independently of the implementation, in parallel.

Spawn each as a persistent teammate with `Agent(team_name=..., name=...)`, not as a one-shot subagent. Start each brief with: load context, then send team-lead a ready message, and do not act on auto-dispatched tasks.

## Coordination rules

1. **Run one pnpm process at a time.** Two teammates that run `pnpm install`, `pnpm build` or `pnpm dev` at once in one monorepo race on `dist/` and `node_modules/`. The symptom: the dev server falls back to an old code path because the Vite restart cannot resolve modules. Tell teammates to stop their dev hosts and scripts before another teammate starts pnpm work.

2. **Ignore the task-list dispatcher.** Stale teammates from earlier `/goal` sessions stay in the team's `config.json`. You cannot delete one: only `TeamDelete` removes them, and it removes all. The auto-coordinator sends any open task to any idle teammate, whatever its role. Brief every new teammate: **"Ignore all task-list messages. Only act on direct SendMessage from team-lead."**

3. **Put the commit SHA or work-item number in every dispatch.** SendMessage is asynchronous. A teammate can reply to message N after you send N+1, and the reply then looks out of context. The identifier tells each side which task a message is about.

4. **Keep worktree paths short on Windows.** Windows limits a path to 260 characters (MAX_PATH). Vitest's chunked imports fail at long paths even when the source is correct: `pnpm test` in `.claude/worktrees/feat-<long-name>/` fails with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. Use a short directory (`.claude/wt/r3f/`) or the main checkout.

5. **An idle teammate is not stuck.** A teammate can go idle several times in one work session. Do not ping at the first idle. Wait for a real sign: no commit on origin about 15 minutes after the dispatch. Then ask for a one-line status.

6. **Verify each report.** When a teammate reports "all green", "X tests pass" or "file written", confirm it with `grep`, `wc` or `git show`. The files on disk are the truth.

7. **Justify each deleted test file.** Test deletions in a migration without replacement remove regression coverage in silence, and bugs then survive until a user sees them. A PR that removes test files states one of these for each:
   - "code under test removed; assertions no longer reachable"
   - "replaced by `<path>` covering the same invariant"
   - "asserted behaviour changed deliberately; new test at `<path>`"

   Review a PR that removes tests with no replacement and no surface change as a removal of regression guards, not as test cleanup.

8. **Never change a test to assert the buggy output.** The symptom is a commit that changes assertion values to match the new code's output, often with a comment that explains the difference away ("the user's intent is not recoverable", "this is the actual output"). Derive the expected value from the engine source, not from either version of the code. A PR that changes an assertion value (not adding or removing a test) states in its body one of:
   - "fixing the test to match a known-correct code change", with a reference to the spec or source.
   - "fixing the test to no longer assert a regression that was just introduced", with a reference to the original commit.

   A test comment that explains away a discrepancy is a signal to reconsider the code, not the test.

9. **Check the verifier's own method before it declares a fix FAILED.** A probe written from the old code's interpretation reports a correct fix as failed. Before a verifier marks a fix FAILED, it:
   1. Derives the expected output from the upstream spec, source or fixture, not from running the old or new code.
   2. Runs the affected unit tests on the fix branch and reports the pass and fail counts.
   3. Runs at least one numerical probe that matches the expected output from step 1.

   If all three support the fix and the visual check disagrees, suspect the visual check (Vite cache, browser cache, wrong branch, wrong build). Stop and confirm the build pipeline before a FAIL.

10. **Answer the pushback, not the question you prefer.** When team-lead questions an implementer's diagnosis with a concrete reference (a commit hash, a test, a spec passage), the implementer's next message engages that reference: it agrees, refutes it with equally concrete evidence or asks for clarification. If the pushback includes a `git show <sha>` or a test path, the reply quotes it and responds to it. More analysis in defence of the first position does not count.

11. **Rebuild core before you test a core change in the dev server.** The `predev` script in `apps/textscene-web/package.json` runs `pnpm --filter @textscene/core build` once, when the dev server starts. `@textscene/core` resolves to `dist/`, so Vite HMR does not see an edit under `packages/textscene-core/src/`, and a correct fix looks broken. After such an edit, restart the dev server or run `pnpm --filter @textscene/core build`, then hard-refresh the browser. If Vite's dependency cache stays stale, restart with `--force`.

## Verification protocol

**A verifier never marks a flow PASS because it "renders without errors".** That misses silent feature misses: a property that is parsed but never applied to the THREE primitive, or a chain of references that resolves but whose result is dropped.

Verify in two layers:

- **Layer 1, per-property regression tests.** For each feature property the renderer claims to support, a vitest and test-renderer test asserts the value of the THREE primitive property (for example `texture.repeat.x === 2` when `uv1_scale=Vector3(2,2,1)`). These tests live in `src/` and run in CI. List them before you start.

- **Layer 2, strict verifier checklists.** For each user flow, `docs/strict-checklists/<flow>.md` holds a per-property table with the expected values, the verification method and a `PASS/FAIL/CANT-VERIFY` column. **When a fixture has variations of one property (for example three planes with different `uv_scale`), add a row that asserts the outputs are pairwise distinct.** Without that row, renders that look identical because they are broken pass.

- **`it.fails()` canaries.** When you add a regression test before its fix, wrap it in `it.fails('...', ...)` with an inline `// EXPECTED-FAIL` comment. The pre-commit hook stays green, and `git grep EXPECTED-FAIL` lists the known bugs. When a fix lands, remove its wrapper: the test now passes, so `it.fails` fails.

## Cycle for implementation and verification

1. Spawn the team with briefs that wait for an explicit assignment. Dispatch no real work until every teammate reports ready.
2. If parallel implementers share types, have the architect draft the contracts first.
3. Write the property inventory and the regression tests before any feature is "done".
4. Have each implementer commit and push after each work item. One work item per commit.
5. Have the verifiers desk-run the strict checklist on one fixture before a real run. This catches drift in the verifier's method.
6. Run the strict checklist. A FAIL stops the verifier. It does not retry in silence.
7. For each FAIL, dispatch a targeted fix work item that adds the regression test for that failure.
8. Re-verify with the same checklist. The row that failed must now pass.
9. Open the PR only when all checklists pass. The PR description links the user guides and shows the canary inventory at zero.

## Record in MEMORY.md after a run

- The team name and the surviving teammates, so a later session can reach them with SendMessage instead of a respawn.
- The agent type of each teammate role.
- The project-specific problems you found (for example "vitest under .claude/worktrees/ exceeds Windows MAX_PATH: use a shorter dir").

## Do not

- Do not spawn one-shot subagents with `Agent({})` when the user asked for a team. SendMessage cannot reach them, and you cannot re-engage them.
- Do not commit with `--no-verify` unless the user authorised it for a specific environmental block (for example Windows MAX_PATH). Record the block in the commit message.
- Do not accept "looks fine" from a verifier. Reject a vague report and ask for the observed values.
- Do not merge a PR that still has `it.fails()` wrappers. The inventory must be at zero.
