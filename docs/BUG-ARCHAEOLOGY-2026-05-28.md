# Bug Archaeology — 2026-05-28

Investigated test rewrites that may have masked regressions during the R3F migration (commits d7a69da / b4ccaab). Ported original correct assertions to new test files and ran them against current code.

---

## Suspects Investigated

### SUSPECT 1: `transform.test.ts` — `decomposeTransform3D` (b4ccaab)

**Status: LATENT BUG CONFIRMED — but already fixed by 99c1479**

**Rewrite commit**: `b4ccaab` (feat(WI-R3F-10): close 20 canary feature-misses)

**Original correct commit**: `401f8f5` (#31 Fix Transform3D decomposition for rotated+scaled planes)

**What b4ccaab did**:

Commit `b4ccaab` re-broke `decomposeTransform3D` by changing `THREE.Matrix4.set()` to treat Godot's `basis_x/y/z` as COLUMN vectors instead of ROW vectors. It then rewrote the `401f8f5` regression test to assert the transposed (buggy) output, with a rationalising comment:

> "the user's 'intended' Z-scale + Ry(+π/2) is not recoverable from the flat 12-float serialisation — composition order is gone once the basis vectors are baked."

That comment was incorrect. Godot's `Basis` stores `Vector3 rows[3]` — the parsed `basis_x/y/z` ARE rows, not columns. The matrix is fully recoverable without ambiguity.

**Concrete numerical divergence**:

For ShortWall transform `Transform3D(-4.371139e-08, 0, 6, 0, 1, 0, -1, 0, -2.6226832e-07, 0, 0, 0)`:

| | `scale.x` | `scale.z` | `rotation.y` |
|---|---|---|---|
| Original 401f8f5 (correct) | ≈ 1 | ≈ 6 | ≈ +π/2 |
| b4ccaab rewrite (buggy) | ≈ 6 | ≈ 1 | ≈ −π/2 |
| Current code after 99c1479 | ≈ 1 | ≈ 6 | ≈ +π/2 |

**User-facing impact**: The ShortWall appeared 2 units wide instead of 12 units wide (narrower by 6×). Observed visually in the hallway fixture proof screenshot. All rotated+scaled planes affected, not just ShortWall.

**Fix**: `99c1479` (fix(walls): correct Godot Basis row-vector convention in decomposeTransform3D) correctly restored the row-major matrix construction and also updated `Component.transform.test.tsx` tests #4–#6 to use the correct row-major basis vectors.

**Also noted**: Commit `b4ccaab` also changed the Y-rotation test INPUT data in `transform.test.ts` (swapping `basis_x.z: 1 → -1`, `basis_z.x: -1 → 1`) claiming this represents "column-major Ry(+π/2)". This change was also reverted by `99c1479`.

---

### SUSPECT 2: `Component.transform.test.tsx` tests #4/#5/#6 (b4ccaab)

**Status: LATENT BUG CONFIRMED — but already fixed by 99c1479**

**Rewrite commit**: `b4ccaab`

**Original commit**: `d7a69da` (feat(WI-R3F-9): add 96 property regression tests)

**What happened**: `d7a69da` created tests #4–#6 with `it.fails` wrappers, using column-major basis vectors (the WI-R3F-9 author's understanding at the time). `b4ccaab` removed the `it.fails` wrappers by implementing the decompose via `THREE.Matrix4.decompose + Euler.setFromQuaternion`, which happened to make those column-major basis vectors produce rotation.x/y/z ≈ +π/2. However, those column-major vectors are not what Godot actually emits — Godot emits ROW vectors.

**Fix**: `99c1479` updated the basis vectors in #4–#6 to the correct row-major forms:
- `Rx(+90°)`: `basis_y: {0, 0, -1}`, `basis_z: {0, 1, 0}` (was `basis_y: {0, 0, 1}`, `basis_z: {0, -1, 0}`)
- `Ry(+90°)`: `basis_x: {0, 0, 1}`, `basis_z: {-1, 0, 0}` (was `basis_x: {0, 0, -1}`, `basis_z: {1, 0, 0}`)
- `Rz(+90°)`: `basis_x: {0, -1, 0}`, `basis_y: {1, 0, 0}` (was `basis_x: {0, 1, 0}`, `basis_y: {-1, 0, 0}`)

---

### SUSPECT 3: All 20 `it.fails` → `it(...)` conversions in b4ccaab

**Status: NO REMAINING LATENT BUGS FOUND**

`b4ccaab` unwrapped 20 `it.fails` assertions covering: Node3D rotation (#4–#6), MeshInstance3D flags (#14, #15), material scalars (#29–#31, #35), PlaneMesh geometry (#53, #54), Camera3D keep_aspect (#66), SpotLight attenuation (#79), WorldEnvironment (#81, #84, #85), Label3D (#91–#94).

Each of these converted tests was re-investigated. All assert correct behavior after the b4ccaab implementation additions (materialScalars, meshGeometry orientation, Camera3D keep_aspect branching, etc.). The assertions themselves were not changed — only the `it.fails` wrapper was removed. The implementations delivered what the tests require.

**Exception**: Tests #4–#6 (covered in Suspect 2 above).

---

### SUSPECT 4: sRGB → linear color conversions (bbebe75)

**Status: LEGITIMATE FIX — not a regression**

`bbebe75` changed color value assertions in `Component.material-scalars.test.tsx` (#18), `Component.material-srgb.test.tsx` (new file), and `renderer.test.ts`. These changes correctly reflect the WI-HALL-2 fix: Godot encodes colors in sRGB; three.js's `<meshStandardMaterial>` treats incoming RGB as linear, so without conversion mid-tones were double-encoded and appeared as bright pink.

The assertion changes are correct (`0.5 sRGB → 0.21404 linear`). The new `Component.material-srgb.test.tsx` explicitly pins the regression with strict inequality assertions.

---

### SUSPECT 5: Other WI-R3F-* test rewrites

**Status: NO LATENT BUGS FOUND**

Checked:
- `d6a99d2` (WI-R3F-8): No existing assertion values changed.
- `ad1e755` (WI-R3F-19): Updated #14 surface_material_override assertion to assert `mesh.material[1]` (array slot) instead of `mesh.material` (scalar). This is correct — WI-R3F-19 implemented the array material semantics.
- `1e79180` (WI-ARCH-2): Resource loader refactor. Deleted obsolete tests, no assertion weakening.
- `cb43aa7` (WI-ARCH-1): PropertyValidator refactor. Designed backward-compatible.

---

## Archaeology Test File

New file: `packages/textscene-core/src/archaeology/transform-regression.test.ts`

Contains 5 tests porting the 401f8f5 original assertions to the current code:

```
✓ [401f8f5] scale.z should be 6 for the ShortWall-like transform
✓ [401f8f5] ReferenceWall (no rotation, just Z-scale) should decompose correctly
✓ [pre-b4ccaab] Ry(+pi/2) row-major basis should yield rotation.y = +pi/2
✓ [d7a69da original] column-major Rx(90°) should NOT give rotation.x=+pi/2 (confirms row vs column distinction)
✓ ShortWall with origin: FACE_X vertex (0,0,1) maps to world x≈6 (end-to-end wall width)
```

All 5 tests pass against current code (HEAD = 4936c93).

---

## Summary

- **1 latent bug found**: `decomposeTransform3D` matrix transposition (b4ccaab). Confirmed by porting original 401f8f5 assertions and observing they FAIL on b4ccaab but PASS on 99c1479.
- **Bug was already fixed**: `99c1479` correct. `4936c93` added a point-mapping regression guard.
- **No other latent bugs found** in the examined areas (materials, PlaneMesh geometry, Camera3D, lights, WorldEnvironment, Label3D, resource pipeline).
- **Archaeology test file** added to `src/archaeology/transform-regression.test.ts` for future regression protection.

---

## Deleted Tests Inventory + Port Priorities

### Meta-Finding: Silent Quality Collapse

The R3F migration (primarily WI-R3F-6) deleted **50 test files** containing approximately **3,000+ test cases**. These covered the full imperative renderer stack: lifecycle management, scene coordination, selection, UI, and all mesh parsers. **None of these deletions were flagged in code review and nobody noticed for ~6 months.** This is a structural quality-control failure: the migration traded a tested imperative codebase for an untested R3F one, leaving the project flying blind on regression risk.

The R3F test suite (`Component.*.test.tsx` files) covers declarative rendering well but does not replicate the breadth of the deleted tests — particularly lifecycle management (add/remove/update/move nodes), scene coordination, resource resolution, UI components, and mesh parser edge cases.

---

### Categories and Definitions

| Category | Meaning |
|---|---|
| `testable-via-R3F` | Behavior still live, coverable by declarative `@react-three/test-renderer` tests |
| `testable-via-imperative-only` | Behavior involves imperative mutation, lifecycle, or deleted classes — needs new imperative harness or integration test |
| `superseded-by-new-test` | Functionally equivalent current test already exists |
| `obsolete` | Class/function deleted in migration; behavior no longer exists in codebase |

| Risk Rank | Meaning |
|---|---|
| **HIGH** | Behavior is live today and a regression would be user-visible or data-corrupting; no current test guards it |
| **MED** | Behavior is live but partially covered, or less likely to regress |
| **LOW** | Behavior obsolete, superseded, or trivial |

---

### Inventory

#### `core/TscnRenderer.test.ts` (~400 lines)
- **Category**: `testable-via-imperative-only` (most tests) / `obsolete` (TscnRenderer class deleted)
- **Risk**: LOW — `TscnRenderer` class no longer exists; its initialization, lifecycle, and `render()` method are gone. R3F `TscnPreviewShell` replaces it. The concept of "renderer object" is gone.
- **Notable exception**: The test that verified `.worldenvironment` sets background color was split into its own file (see next).

#### `core/TscnRenderer.worldenvironment.test.ts` (~100 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — background color setting from `WorldEnvironment` nodes is live R3F behavior. Current `WorldEnvironment` component tests exist but focus on rendering the node; a dedicated test that the THREE.js scene background changes is absent.
- **Port recommendation**: Add assertion in `r3f/nodes/worldenvironment/Component.test.tsx` that `scene.background` gets set to the environment's sky color.

#### `core/SceneManager.test.ts` (~600 lines)
- **Category**: `testable-via-imperative-only` / `obsolete`
- **Risk**: LOW — `SceneManager` class no longer exists in R3F architecture. Replaced by `TscnPreviewShell`'s `useTscnScene` hook. The caching, `addScene`, and `loadScene` APIs are gone.

#### `core/SceneManager.external-rendering.test.ts` (~300 lines)
- **Category**: `testable-via-imperative-only` / partially `testable-via-R3F`
- **Risk**: MED — Tests PackedScene loading and rendering. The R3F equivalent (`PackedScene` via `NodeDispatcher`) exists but lacks a test that actually verifies external scene content renders as children. See WI-R3F-12 coverage gap.
- **Port recommendation**: Add R3F test that `<TscnPreviewShell>` renders PackedScene children into the THREE.js scene.

#### `core/SceneManager.nested-external.test.ts` (~350 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tests 3-level-deep nested `PackedScene` instancing (leaf → middle → top). This specific scenario (multi-level nesting) has no current R3F test and is a real regression risk — a `useTscnScene` recursion bug would silently drop nested nodes.
- **Port recommendation**: Port as a `TscnPreviewShell` integration test using in-memory TSCN strings for all 3 levels.

#### `core/NodeLifecycleManager.test.ts` (2832 lines — largest deleted file)
- **Category**: `testable-via-imperative-only` / partially `testable-via-R3F`
- **Risk**: HIGH — This was the most comprehensive test file in the repo. Covered: `addNode`, `removeNode`, `updateNode`, `setNodeVisibility`, userData management, deep nesting, GLB instance loading with material cloning, children sync, error recovery. The R3F migration has no equivalent comprehensive coverage. A regression in `NodeDispatcher` traversal or `useTscnScene` would not be caught.
- **Port recommendation (highest priority)**: Port a subset as `NodeDispatcher.integration.test.tsx` covering: node add/remove/update, deep nesting, GLB loading, children synchronization. This alone would restore ~60% of deleted regression coverage.

#### `core/NodeTracker.test.ts` (431 lines)
- **Category**: `obsolete`
- **Risk**: LOW — `NodeTracker` class (Map of path→Object3D + path→TscnNode) was deleted. In R3F, node identity is managed implicitly by React's reconciler. No current equivalent exists to port to.

#### `core/HelperManager.test.ts` (334 lines)
- **Category**: `obsolete`
- **Risk**: LOW — `HelperManager` (BoxHelper for node highlight/hover) was deleted with the imperative renderer. R3F branch has no node highlighting/selection UI. Tests are moot.

#### `core/SelectionManager.test.ts` (576 lines)
- **Category**: `obsolete`
- **Risk**: LOW — `SelectionManager` (raycasting, node selection from screen coords) was deleted. No selection feature in current R3F branch. Tests are moot.

#### `core/ResourceRecoveryManager.test.ts` (253 lines)
- **Category**: `obsolete`
- **Risk**: LOW — `ResourceRecoveryManager` (missing resource tracking + recovery workflow) was deleted. The R3F branch handles missing resources with silent fallbacks, not with a recovery manager. Tests are moot.

#### `core/SceneSetup.test.ts` (305 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tests `createDefaultScene`, `createDefaultCamera`, `createOrbitControls`, and `setupThreeJsScene` helpers. These helpers still exist in R3F form (THREE.js scene setup in `TscnPreviewShell`). Background color (`0x2a2a2a`), ambient light intensity (`0.6`), and directional light position could all regress silently.
- **Port recommendation**: Add assertions in `TscnPreviewShell.test.tsx` for default scene background color, ambient light intensity, and directional light presence.

#### `core/NodeRegistry.test.ts` (~200 lines)
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — Current `NodeRegistry` test file exists at `packages/textscene-core/src/core/NodeRegistry.test.ts` (not deleted). The deleted version tested the imperative `parseNodeWithRegistry` and `renderNodeWithRegistry` APIs; the new version tests registration and dispatch correctly.

#### `resources/ResourceRegistry.test.ts` (~200 lines)
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — `ResourceRegistry` still exists and the main patterns (texture loading, GLB loading, deduplication) are covered in current tests.

#### `resources/ResourceManager.test.ts` (182 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tests `parseResourceReference` and `resolveGeometry` helpers. These are utility functions that still exist (or have equivalents). The `parseResourceReference` function may have been renamed or moved. If it still exists, the tests are easily portable.
- **Port recommendation**: Verify function still exists; port as pure unit tests if so.

#### `integration/renderPipeline.integration.test.ts` (~300 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Full TSCN→Parse→Render→THREE pipeline integration test including material color assertions (albedo, metallic, roughness). This kind of end-to-end "the color I put in is the color I get out" test is critical for catching parser-renderer disconnects. No current R3F equivalent exists.
- **Port recommendation**: Port as `TscnPreviewShell.integration.test.tsx` that loads a TSCN string with known material colors and asserts `mesh.material.color` values.

#### `integration/unsupported-nodes.test.ts` (~100 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tests that unsupported node types get `userData.isUnsupportedType = true`. This fallback behavior in `NodeDispatcher` is live but untested.
- **Port recommendation**: Add 2 assertions in `NodeDispatcher.test.tsx` verifying unknown node types produce a placeholder with correct userData flag.

#### `integration/architecture.test.ts`
- **Category**: `obsolete`
- **Risk**: LOW — File was empty (no output from `git show`). Already deleted before final main commit or contains no content.

#### `integration/camera3d.integration.test.ts`
- **Category**: `obsolete`
- **Risk**: LOW — File was empty. Same situation as architecture.test.ts.

#### `nodes/3d/meshinstance3d/renderer.test.ts` (~200 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tested `createMeshInstance3D`: shadow casting (`castShadow=true`, `receiveShadow=true`), placeholder mesh for missing geometry, userData metadata. Current `MeshInstance3D` component tests exist but shadow casting and the placeholder fallback behavior are not explicitly tested.
- **Port recommendation**: Add assertions in `r3f/nodes/meshinstance3d/Component.test.tsx` for `castShadow`, `receiveShadow`, and placeholder when geometry is null.

#### `nodes/base/node3d/renderer.test.ts` (~150 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tested `applyNode3DTransform` with the CORRECT row-major Ry(+90°) basis (`basis_x:{0,0,1}`, `basis_z:{-1,0,0}`). This test file used correct semantics that were **lost in b4ccaab** and only restored by 99c1479. Its absence meant the row-vector regression had no test guard for months.
- **Note**: The 5 archaeology tests in `src/archaeology/transform-regression.test.ts` now cover this ground. No further porting needed.

#### `nodes/3d/camera3d/renderer.test.ts` (~200 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested orthographic camera frustum (`top=5`, `bottom=-5` for `size=5`), FOV conversion. Current `Camera3D` R3F component tests exist but do not assert `OrthographicCamera` frustum parameters directly.
- **Port recommendation**: Add ortho frustum assertions in `r3f/nodes/camera3d/Component.test.tsx`.

#### `nodes/3d/label3d/renderer.test.ts` (~200 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested billboard mode, canvas texture creation, text rendering. Current `Label3D` R3F tests focus on parse; the canvas-texture rendering path is not tested.

#### `nodes/3d/worldenvironment/renderer.test.ts` (~150 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested background color, Environment SubResource parsing. Partially superseded but scene background assertion missing (see `TscnRenderer.worldenvironment.test.ts` above).

#### `nodes/3d/lights/omnilight3d/renderer.test.ts` (~200 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tested `intensity = light_energy * 2` scaling factor, PointLight `distance` and `decay`. Current `OmniLight3D` R3F tests exist but do NOT test the `*2` intensity scaling. If the scaling factor is removed or changed, no test will catch it.
- **Port recommendation**: Add `intensity = light_energy * 2` assertion in `r3f/nodes/omnilight3d/Component.test.tsx`.

#### `nodes/3d/lights/spotlight3d/renderer.test.ts` (~200 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tested SpotLight angle conversion (degrees → radians), target object linking. The degrees→radians conversion is a silent failure mode — wrong result, no crash.
- **Port recommendation**: Assert `spotLight.angle = spot_angle_degrees * (Math.PI / 180)` in spotlight component test.

#### `nodes/3d/lights/directionallight3d/renderer.test.ts` (~150 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested `intensity = light_energy * 2` scaling for DirectionalLight. Same gap as OmniLight above.
- **Port recommendation**: Add intensity scaling assertion in directionallight component test.

#### `resources/meshes/boxmesh/renderer.test.ts` (~150 lines)
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — `boxmesh.test.ts` (kept in R3F branch) covers parser and renderer. Geometry dimensions tested.

#### `resources/meshes/boxmesh/boxmesh.test.ts` (kept with main, not deleted)
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — This file EXISTS on current branch. Not a gap.

#### `resources/meshes/capsulemesh/renderer.test.ts` (~100 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested `geometry.parameters.length` (OLD THREE.js API). New THREE.js uses `.height`. The `capsulemesh.test.ts` file uses the new `.height` API and passes. Low risk but the API rename went undetected because the old test was deleted instead of updated.

#### `resources/meshes/cylindermesh/cylindermesh.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — Current `cylindermesh.test.ts` exists in R3F branch and covers parser + renderer.

#### `resources/meshes/planemesh/renderer.test.ts` (~150 lines)
- **Category**: `testable-via-R3F`
- **Risk**: HIGH — Tested subdivision clamping and orientation-dependent size mapping (FACE_X vs FACE_Y vs FACE_Z). The orientation logic is complex and a regression here produces silently incorrect geometry. Current `planemesh.test.ts` covers parser but the renderer geometry assertions (width/height/depth assignment per orientation) are absent.
- **Port recommendation**: Port renderer geometry assertions into `planemesh.test.ts` or a new `planemesh.renderer.test.ts`.

#### `resources/meshes/planemesh/linterParser.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — Linter validator tests for `flip_faces`, `orientation` booleans. Current `linterParser.test.ts` exists and passes.

#### `resources/meshes/prismmesh/prismmesh.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — `prismmesh.test.ts` exists on current branch; parser tests pass.

#### `resources/meshes/prismmesh/renderer.test.ts` (~150 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — Tested `CylinderGeometry(radialSegments=3)` for prism approximation, `size.x/2` radius mapping. Current branch has `prismmesh.test.ts` that includes renderer tests (`createPrismMeshGeometry`). Coverage exists.
- **Risk**: LOW (partially superseded).

#### `resources/meshes/spheremesh/spheremesh.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — Current `spheremesh.test.ts` exists and passes.

#### `resources/meshes/torusmesh/torusmesh.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — Current `torusmesh.test.ts` exists and passes.

#### `resources/materials/standardmaterial3d/linterParser.test.ts`
- **Category**: `superseded-by-new-test`
- **Risk**: LOW — `standardmaterial3d/linterParser.test.ts` still exists on current branch.

#### `ui/NodeDetailsFormatter.test.ts` (~400 lines)
- **Category**: `testable-via-R3F` (DOM rendering, not THREE.js)
- **Risk**: MED — `NodeDetailsFormatter` still exists and generates HTML for node details panel. Tests verified HTML output for node type, path, parent, and custom properties. No current equivalent test exists in R3F branch.
- **Port recommendation**: Port HTML-output assertions as straightforward unit tests (no THREE.js needed).

#### `ui/SceneTreeViewer.test.ts` (~300 lines)
- **Category**: `testable-via-R3F`
- **Risk**: MED — `SceneTreeViewer` renders DOM tree from `TscnNode[]`. Tests verified expand/collapse, search filtering, node selection callbacks. No current equivalent tests.
- **Port recommendation**: Port as DOM unit tests using `@testing-library/dom` or `happy-dom`.

#### `ui/TscnPreviewUI.test.ts` (~400 lines)
- **Category**: `testable-via-R3F`
- **Risk**: LOW — `TscnPreviewUI` was the imperative UI orchestrator wrapping canvas + tree + details. In R3F, the equivalent is `TscnPreviewShell` React component. The test mocked everything; no real behavior at risk.

#### `ui/ViewportSelector.test.ts` (~300 lines)
- **Category**: `obsolete`
- **Risk**: LOW — `ViewportSelector` (mouse event → raycaster → node selection) was deleted with `SelectionManager`. No selection feature in R3F branch.

#### `apps/textscene-vscode/src/TscnPreviewPanel.test.ts` (~600 lines)
- **Category**: `testable-via-imperative-only`
- **Risk**: HIGH — Tested VS Code webview panel lifecycle: creation, message handling (`requestScene`, `loadResource`, `nodeSelected`), panel reuse, incremental update dispatch. The VS Code extension was heavily modified but `TscnPreviewPanel.ts` still exists. No current equivalent test exists for the panel.
- **Port recommendation**: Port as the highest-priority VS Code test file. Covers the critical message-passing boundary between extension host and webview.

#### `apps/textscene-vscode/src/diffUtils.test.ts` (~300 lines)
- **Category**: `testable-via-imperative-only`
- **Risk**: HIGH — Tested `computeIncrementalChanges`: detects unchanged content, single node property modification, threshold for full reload. `diffUtils.ts` still exists on current branch. This is a pure utility with no R3F dependency — the tests would pass as-is.
- **Port recommendation**: Immediate port — `diffUtils.test.ts` is a self-contained pure-function test that would work verbatim on the current branch.

#### `apps/textscene-vscode/src/incremental-updates.test.ts`
- **Category**: `obsolete`
- **Risk**: LOW — File was empty (no output from `git show`). Deleted before content was written, or never committed.

#### `apps/textscene-vscode/src/resource-loading.test.ts`
- **Category**: `obsolete`
- **Risk**: LOW — File was empty. Same situation.

---

### Priority Port List (Ranked)

| Priority | File | Category | Why |
|---|---|---|---|
| **P1** | `apps/textscene-vscode/src/diffUtils.test.ts` | pure utility | Self-contained, works verbatim; `diffUtils.ts` is live and untested |
| **P1** | `core/NodeLifecycleManager.test.ts` (subset) | R3F integration | Most comprehensive deleted test; no R3F equivalent for add/remove/update lifecycle |
| **P1** | `apps/textscene-vscode/src/TscnPreviewPanel.test.ts` | VS Code | Panel message-passing has no current test; critical extension boundary |
| **P1** | `integration/renderPipeline.integration.test.ts` | R3F integration | Only end-to-end color-in/color-out test; parser-renderer disconnect is live risk |
| **P2** | `core/SceneManager.nested-external.test.ts` | R3F integration | 3-level PackedScene nesting has no R3F test; silent-drop risk is real |
| **P2** | `nodes/3d/lights/omnilight3d/renderer.test.ts` | R3F component | `intensity * 2` scaling untested; silent wrong intensity |
| **P2** | `nodes/3d/lights/spotlight3d/renderer.test.ts` | R3F component | Degrees→radians angle conversion untested; silent wrong cone |
| **P2** | `nodes/3d/meshinstance3d/renderer.test.ts` | R3F component | `castShadow`/`receiveShadow` and placeholder mesh untested |
| **P2** | `resources/meshes/planemesh/renderer.test.ts` | R3F component | Orientation→geometry assignment is complex; no renderer assertions |
| **P3** | `core/SceneSetup.test.ts` | R3F component | Scene background color, light intensity — cosmetic but user-visible |
| **P3** | `nodes/3d/camera3d/renderer.test.ts` | R3F component | Ortho camera frustum parameters untested |
| **P3** | `nodes/3d/lights/directionallight3d/renderer.test.ts` | R3F component | Same `intensity * 2` gap as OmniLight |
| **P3** | `ui/NodeDetailsFormatter.test.ts` | DOM unit test | Formatter still live; HTML regression would be silent |
| **P3** | `ui/SceneTreeViewer.test.ts` | DOM unit test | Tree viewer still live; expand/collapse/search untested |
| **LOW** | All others | obsolete or superseded | Classes deleted or coverage already exists |

---

### Totals

| Category | Count |
|---|---|
| `obsolete` (class/function deleted) | 14 |
| `superseded-by-new-test` | 10 |
| `testable-via-R3F` or `testable-via-imperative-only` (live gaps) | 26 |
| **P1 ports (immediate value)** | 4 |
| **P2 ports (regression risk)** | 5 |
| **P3 ports (quality debt)** | 5 |
