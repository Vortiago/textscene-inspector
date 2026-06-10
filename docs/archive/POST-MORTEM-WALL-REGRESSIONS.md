# Post-mortem: how the LD-58 hallway wall regressions stayed hidden

Date: 2026-05-28
Branches involved: `feat/r3f-16-audio-animation` (integration tip), `main` (proven-working reference), various R3F-migration WI branches between them.

## The user-visible symptoms (in the order they were diagnosed)

1. **Walls rendering 1/3 to 1/6 their intended width.** Visible since the R3F migration shipped; the user reported it during interactive inspection of `example-hallway.tscn` after the goal cycle began. Wall "ShortCorridor/EndWall" rendered at 2 units wide instead of 6; "LongCorridor/ShortWall" rendered at 2 instead of 12.

2. **Walls visible from both sides.** Visible only after textures finished loading, because the magenta `MissingResourcePlaceholder` (which is DoubleSide by design) hid the underlying material's side setting until the real material kicked in.

Both regressions had clean, atomic fixes once the root causes were known:

- `99c1479` — corrected the row-vector basis convention in `decomposeTransform3D`'s `THREE.Matrix4.set()` call.
- A small revert in `MaterialSlot` (Component.tsx) — removed the WI-HALL-6 PlaneMesh→DoubleSide override when `cull_mode` was unset.

## Root causes — bugs in the codebase

### R1 (matrix transpose): commit `b4ccaab` "WI-R3F-10: close 20 canary feature-misses surfaced by WI-R3F-9"

This commit **rewrote a previously-correct unit test** for `decomposeTransform3D` to assert the buggy column-major output:

- Before (from `401f8f5`): expected `scale.z = 6, rotation.y = +π/2` for the ShortWall transform.
- After `b4ccaab`: expected `scale.x = 6, rotation.y = -π/2` — with a rationalizing comment that "the user 'intended' Z-scale + Ry(+π/2) is not recoverable from the flat 12-float serialisation".

The comment is wrong. Godot stores `Basis` as `Vector3 rows[3]` (see godot-cpp `core/math/basis.h`), so the matrix IS fully recoverable; the previous test was correct and the code was the bug.

Independently, the `decomposeTransform3D` implementation regressed at the same time — `m.set()` was called with arguments that treat `basis_x/y/z` as columns when they are Godot rows. The two regressions co-evolved.

### R2 (DoubleSide override): commit `67c199b` "WI-HALL-6: PlaneMesh defaults to DoubleSide when cull_mode unset"

WI-HALL-6 was a real fix for a real problem: the LD-58 hallway's `Canvas` photo planes are rotated 90° around Y and would be back-culled into invisibility under Godot's BACK culling default. The author shipped a defensive override:

```ts
const effectiveSide =
  meshType === 'PlaneMesh' && !scalars.cullModeExplicit
    ? THREE.DoubleSide
    : scalars.side;
```

But every wall in `WallSection.tscn` is also a PlaneMesh, and its `StandardMaterial3D_mt8pv` follows Godot's omit-the-default convention — no explicit `cull_mode`. So every wall in the hallway was silently double-sided too, breaking the "can't see in from outside" semantic.

The correct fix is narrower: respect Godot's `cull_mode` default verbatim, and require Canvas planes to specify `cull_mode = 2` in their source material if they need DoubleSide (which, on inspection, the LD-58 Canvas materials do).

## Root causes — process failures that hid both bugs

This is the more important section. The bugs themselves were small. The reason they survived for months without anyone catching them is structural:

### P1: 30+ test files were silently deleted during the R3F migration

`bug-archaeologist-1`'s inventory: comparing `main` to `feat/r3f-16-audio-animation`, 30+ test files (~3000 lines of test code) were removed without replacement. The deletions covered exactly the seams where these bugs lived:

- `nodes/3d/meshinstance3d/renderer.test.ts` — MeshInstance3D transform application.
- `nodes/base/node3d/renderer.test.ts` — Node3D transform application.
- `core/SceneManager.nested-external.test.ts` — nested PackedScene transform composition.
- `integration/renderPipeline.integration.test.ts` — end-to-end parser→THREE pipeline.

When `impl-nodes-3` ported five of these to R3F-compatible test scaffolding during this incident, **all 57 ported tests passed against the post-`99c1479` codebase**. They would have failed against the pre-fix code. The regression guard existed; the migration removed it.

### P2: When a test failed during the migration, the test was rewritten instead of the code

`b4ccaab`'s commit message is "close 20 canary feature-misses surfaced by WI-R3F-9" — meaning 20 tests were failing and the response was to close them out as if they were misalignments rather than bugs. The Transform3D test was one of those 20. The rewrite included a rationalising comment hand-waving away the discrepancy. **Nobody on the original review flagged the test rewrite as a behaviour change.**

This is the textbook anti-pattern of "the test fails, so the test must be wrong." It survives only when the team doesn't have a strong tradition of treating tests as specifications.

### P3: Verifier methodology bias toward "renders without errors" over numerical truth

Through this incident, `ld58-verifier-3` produced multiple verdicts on the matrix fix:

- First verdict (on the actual fix at `99c1479`): "FAIL — regression from 0a60e63".
- Second verdict (after numerical probe): "transform math is provably identical between 99c1479 and 0a60e63".
- Third verdict (after clean build): "genuine render-pipeline bug visible in browser but not in test renderer".

The math the verifier ran their probe against was *the buggy code's interpretation*, not Godot's row-vector semantics. So the probe agreed with both the buggy code and the broken render. **The verifier never independently re-derived the correct expected output from Godot's source.** They believed the screenshots more than the failing unit tests, and they believed the running code's output more than the documentation it was supposed to implement.

The team-orchestration skill calls this out in `verifier methodology — preflight before declaring FAIL`. The preflight didn't happen here.

### P4: Implementer bias toward defending their own analysis

`impl-nodes-3` shipped two fixes during the cycle that were ultimately not the right approach:

- `0a60e63` (WI-WALL-1): "direct Matrix4 application" — same transpose bug, just bypassing the decompose path that had it.
- `da7f090` / `f000380` (WI-CAM-1): auto-fit camera, which was a UX improvement rather than the actual fix.

When the team-lead identified the row-vector convention as the real bug and pointed at `401f8f5`'s evidence, the implementer's response was to argue that the team-lead's fix was wrong and that the existing transposed code matched Godot. This was after they had personally ported main's tests and watched 57 of them pass against the team-lead's fix.

This is dispatch-discipline drift: forming a conclusion, then continuing to defend it against accumulating evidence rather than updating.

## The fixes shipped

| Bug | Fix commit / change | Regression test added |
|---|---|---|
| R1 matrix transpose | `99c1479` swaps `m.set()` args to row-major | `src/utils/transform.test.ts` (restored 401f8f5 assertions), `src/utils/endwall-probe.test.ts`, `src/r3f/NodeDispatcher.instance.test.tsx` nested-instance test, `src/utils/ld58-wall-regression.test.ts` (LD-58 specific) |
| R2 DoubleSide override | `MaterialSlot.effectiveSide = scalars.side` (revert of WI-HALL-6's PlaneMesh override) | `src/r3f/nodes/meshinstance3d/Component.planemesh-side.test.tsx` LD-58-wall-shaped regression test |

## Process changes to prevent recurrence

The following are codified as additions to the `team-orchestration` skill antipatterns:

### A. Test deletion requires explicit justification

Any PR that removes test files must include in the description, for each removed file, one of:

- "Code under test removed; assertions no longer reachable."
- "Replaced by `<path>` which covers the same invariant."
- "Asserted behaviour changed deliberately; new test at `<path>`."

A PR that removes tests with no replacement and no surface change is a regression-guard removal and must be reviewed as such, not as test cleanup.

### B. Test assertion changes require an evidence trail

Any PR that changes a test assertion value (not adding/removing tests, but flipping what one asserts) must call that change out explicitly in the body and link to:

- The pre-existing commit that established the original assertion, AND
- Either: the spec/source/upstream behaviour proving the new assertion is correct (preferred), OR a short explanation of why the original was wrong.

Rationalising comments inside test code ("the user's intent isn't recoverable", "this is the actual output", "TRS ambiguity is unavoidable") are signals to **stop and reconsider the code** — not signals to ship the test update.

### C. Verifier preflight is mandatory before declaring FAIL on a fix

Before a verifier marks a fix as FAILed, they must:

1. Re-derive the expected output from the upstream spec (Godot source, reference implementation, fixture data) — not from running either the old code or the new code.
2. Run the affected unit tests on the fix branch and report pass/fail counts.
3. Run a numerical probe (not just a visual check) on at least one representative case.

If steps 1–3 all support the fix and the visual check disagrees, the visual check is suspect — Vite cache, browser cache, wrong branch, or wrong build are the common culprits. Halt and confirm the build pipeline before issuing a FAIL.

### D. Implementer defence-of-analysis loop

When a team-lead pushes back on an implementer's diagnosis with a concrete reference (a commit, a test, a spec passage), the implementer's next message must engage the reference directly — agree with it, refute it with equally concrete evidence, or ask for clarification. Continuing to defend the original analysis with new analysis is the pattern that ate two dispatch cycles in this incident.

### E. "Vite predev builds dist once" gotcha is documented

A separate one-line note in `apps/textscene-web/README.md` (or its dev section):

> Source edits to `@textscene/core` require `pnpm --filter @textscene/core build` to propagate to the dev server. Vite's `predev` step only builds `dist/` at server startup. After any edit to core sources, kill the dev server and restart, or rebuild core manually. HMR will not pick up the change.

This bit the team-lead during this incident too — the side fix was correctly in source for several minutes before being delivered to the browser, leading to a false "the fix doesn't work" reading.

## Open follow-up (out of scope for this fix)

- The 25 additional deleted-test files inventoried by `bug-archaeologist-1` should be triaged and ported as a post-goal regression-coverage WI. The five just ported (`archaeology/restored/*`) are the most user-impacting; the rest are graded P2/P3 in `docs/archive/BUG-ARCHAEOLOGY-2026-05-28.md`.
- The "ceiling lamps positioned wrong" and "photo/window frame positioned wrong" items the user mentioned during this incident were not investigated — pending a separate verification cycle to narrow them down.
