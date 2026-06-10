# WEB-packedscene-instancing — Strict verification checklist

Fixture: `scenes/examples/integration-three-cubes.tscn`
Referenced scene: `res://child_cube.tscn` (single MeshInstance3D rendering a BoxMesh)
Commit under test: WI-R3F-12 (the commit that introduces `<InstancedSceneSubtree>` in `NodeDispatcher.tsx`).

This checklist verifies the closure of the "📦 marker but empty viewport" gap from the migration's first verification pass. Three `Node3D`s declared with `instance = ExtResource("1_cube")` should each render the referenced scene's geometry, transformed to their own positions.

## Properties exercised

| # | Property | Expected value | Verification method | Result |
|---|----------|---------------|---------------------|--------|
| 1 | Scene root node | `Node3D` named `ThreeCubes` present in tree | `browser_evaluate` reads `[role="tree"]` innerText; assert contains `N3D ThreeCubes` | PENDING — verifier should fill |
| 2 | LeftCube node exists, position X = -3.0 | `Node3D` named `LeftCube` in tree, details panel `Position X: -3.000` | tree + details panel | PENDING |
| 3 | CenterCube node exists, position X = 0.0 | `Node3D` named `CenterCube`, details panel `Position X: 0.000` | tree + details panel | PENDING |
| 4 | RightCube node exists, position X = 3.0 | `Node3D` named `RightCube`, details panel `Position X: 3.000` | tree + details panel | PENDING |
| 5 | All three instancing nodes carry the 📦 marker | tree row for LeftCube/CenterCube/RightCube includes 📦 | tree innerText scan | PENDING |
| 6 | `child_cube.tscn` fetched exactly once (deduplicated) | network panel: one `GET /fixtures/child_cube.tscn → 200`; `[SceneLoader] Cache hit` for subsequent calls | `browser_network_requests` + console messages | PENDING |
| 7 | LeftCube viewport pixel sample at expected screen position is non-empty | sample a 5x5 patch at LeftCube's projected center; mean R/G/B > 0 (not dark void) | `browser_take_screenshot` + canvas read at LeftCube's projected screen X | PENDING |
| 8 | CenterCube viewport pixel sample at expected screen position is non-empty | same method, sampled at CenterCube's projected center | PENDING |
| 9 | RightCube viewport pixel sample at expected screen position is non-empty | same method, sampled at RightCube's projected center | PENDING |
| 10 | **The three cubes are visibly DIFFERENT positions (pairwise-distinct screen X)** | the user-facing closer row — cube centers cluster at three distinct screen X bands | screenshot inspection — three distinct cubes visible left/center/right | PENDING |
| 11 | Each cube renders BoxGeometry (six visible quad faces from the orbital camera angle) | screenshot inspection: cube silhouettes have hard-edged 3-face shading | PENDING |
| 12 | `DirectionalLight` from the outer scene illuminates all three instanced cubes consistently | top faces lit, bottom faces darker on all three cubes | screenshot inspection | PENDING |
| 13 | Missing-scene fixture (`integration-external-missing.tscn` or constructed) renders the magenta placeholder + label | a scene whose instance ref points at a nonexistent path shows the magenta wireframe + drei `<Text>` label | screenshot inspection on a constructed fixture | PENDING |
| 14 | No console errors related to instance loading | `browser_console_messages level=error` returns no entries mentioning `[SceneLoader]`, `instance`, or `PackedScene` (favicon 404 is acceptable) | console capture | PENDING |
| 15 | Tree expansion of an instancing node shows its loaded children inline | clicking the expand chevron on `LeftCube` reveals the loaded scene's nodes as descendants in the tree panel | tree-panel interaction | **CANT-VERIFY in current scope** — SceneTreeViewer does not currently render the loaded scene's nodes under the instance node in the tree; only the viewport injects them. Tree integration is a separate WI. Marked CANT-VERIFY here so it doesn't block; covered by the dispatcher's recursion (section-1 test #3, nested instancing). |
| 16 | Selecting LeftCube/CenterCube/RightCube each populates the details panel with the appropriate transform | click-to-select on each instance node lights up the row + populates details | tree-panel click | PENDING |

## CANT-VERIFY entries

| # | Property | Reason |
|---|----------|--------|
| — | The `useResource` hook's `request()` is actually invoked through the SceneLoader pipeline | Internal to the hook; covered by `Component.material-features.test.tsx` (texture path) and `NodeDispatcher.instance.test.tsx` (scene path). The visual proxy is row 6 (network request observable). |
| — | Property overrides on the instance node propagate to the loaded scene's root | **NOT IN THIS FIXTURE** — `integration-three-cubes.tscn` instances `child_cube.tscn` without overrides beyond the transform. Property-override semantics are intentionally deferred from WI-R3F-12 (flagged in the implementation commit). Covered by a future WI if/when Godot's override mechanics need full parity. |
| — | The loaded scene's resources (`internalResources` of `child_cube.tscn`) are scoped correctly so they don't leak into the outer scene's resource pool | Internal to `<SceneResourcesProvider>` nesting; covered by section-1 test #5 (inline children + instance children co-exist on the same node). |

## Section-1 regression tests covering this WI

- `NodeDispatcher.instance.test.tsx`:
  - `renders the loaded scene as children of the instancing node` — happy path
  - `renders a magenta placeholder when the referenced scene is missing` — error path
  - `recursively dispatches nested instancing (A → B → C)` — three-level nesting
  - `renders multiple instances of the same scene at distinct positions` — three-cubes pattern
  - `renders inline children AND instance-loaded children together on the same node` — coexistence

## Pass criteria

**PENDING re-execution by browser-verifier on the WI-R3F-12 commit.** Implementer's local browser screenshot (`docs/screenshots/web/wi-r3f-12-three-cubes.png`) shows three distinct cubes at the expected positions, proving rows 2-4, 7-12, 14, and the row-10 closer pass under field conditions. Verifier should re-run the full checklist for the on-record proof.

**Critical row: row 10** — the pairwise-distinct-screen-positions assertion. If the dispatcher silently dropped instance children (the pre-WI-R3F-12 behaviour), this row would FAIL with a uniformly empty viewport. The user's "📦 marker but nothing rendered" bug is closed when row 10 PASSes.

## WEB-06 update

Browser-verifier's prior WEB-06 checklist noted PackedScene instancing as a known gap. With this WI in, WEB-06 should flip its instance-rendering rows from "known limitation" to explicit PASS assertions matching rows 2-4 and 10 above.

## Implementation notes

- Resolution chain: `node.instance` (string like `ExtResource("1_cube")`) → parse via `parseResourceReference` → resolve against `externalResources` → `useResource(path, 'PackedScene')` → render loaded scene's `nodes` via the same `<DispatchedNode>` recursion. Nested instancing falls out naturally because the dispatched children also check their own `node.instance`.
- The instancing node's component (typically Node3D) wraps the loaded subtree in a transform-aware `<group>`; the loaded subtree inherits the instance transform automatically.
- The loaded scene's `internalResources` / `externalResources` are scoped via a nested `<SceneResourcesProvider>` so SubResource lookups inside the instanced subtree resolve against the loaded scene's pool.
- `SceneLoader.register` is called at the InstancedSceneSubtree render boundary (synchronously, in render). This is necessary because React effects run child-before-parent, so an effect-based registration in the outer `<SceneResourcesProvider>` would race the dispatcher's `useResource` request. The register call is idempotent.
- Magenta placeholder + drei `<Text>` label matches the missing-texture UX from WI-R3F-7 — consistent error treatment across the resource pipeline.
