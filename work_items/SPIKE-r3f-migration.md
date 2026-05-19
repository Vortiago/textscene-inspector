# SPIKE: React Three Fiber (R3F v9) Migration — RFC

**Status**: Draft (v2 — revised after branch audit)  
**Author**: Codebase Architect  
**Trigger**: User is mid-Phase-13.5, asking whether R3F replaces the reconciliation work remaining in WI-78.5 and WI-78.6 before committing to implementing them manually.  
**Primary motivation stated by user**: Better testing, not architectural aesthetics.

---

## 0. Executive Summary

**Recommendation revised to: Restart clean on `main` + adopt R3F (Path B).**

The initial recommendation assumed the existing Phase 13.5 branch work was load-bearing and largely functional. A branch audit shows that assumption was wrong. The reconciliation is not wired up, several test files have type errors against nonexistent types, and the webview explicitly comments it does full re-renders rather than incremental updates. The user's description of the branch state ("not working as intended") is accurate. Given that a restart is likely cheaper than fixing-plus-finishing, and R3F eliminates the hardest remaining items, Path B becomes the strongest option.

---

## 1. Survives Intact

These directories/files are unaffected by any R3F migration scenario:

- `packages/textscene-core/src/parser/` — pure TS text parsing, no DOM/WebGL
- `packages/textscene-core/src/linter/` — pure validation, no renderer dependency
- `packages/textscene-core/src/nodes/**/parser.ts` — data transformation only
- `packages/textscene-core/src/nodes/**/linter.ts` and `**/linterValidators.ts` — rule logic only
- `packages/textscene-core/src/nodes/**/types.ts` — TypeScript type definitions
- `packages/textscene-core/src/core/SceneGraph.ts` — immutable data model (WI-78.1, done)
- `packages/textscene-core/src/core/SceneGraphBuilder.ts` — copy-on-write builder (WI-78.2, done)
- `packages/textscene-core/src/core/nodeDependsOnPath.ts` — dependency predicate (working)
- `packages/textscene-core/src/core/NodeRegistry.ts` — self-registration dispatcher
- `packages/textscene-core/src/resources/` — FileEventBus, ResourceEventBus, ResourceLoader pipeline (WI-79, done, working)
- `packages/textscene-core/src/utils/` — transform math, node path utilities
- `scenes/` — fixture and example .tscn files
- All `*.test.ts` files for parsers, linters, and utilities

---

## 2. Gets Rewritten

The following files would need full rewrites in an R3F migration:

| File | Current LOC | Migration scope |
|---|---|---|
| `core/TscnRenderer.ts` | 780 | Full rewrite — becomes a React component tree host |
| `core/NodeLifecycleManager.ts` | 576 | **Deleted** — React owns this lifecycle |
| `core/SceneManager.ts` | 439 | Kept but reshaped — becomes a data provider |
| `nodes/**/renderer.ts` (9 files) | ~1,800 total | Each becomes `nodes/**/Component.tsx` |
| `nodes/3d/meshinstance3d/renderer.ts` | 474 | Full rewrite — most async material logic |
| `apps/textscene-web/src/main.ts` | 403 | Rewrite — mount React root, pass SceneGraph as prop |
| `apps/textscene-vscode/src/webview/webview.ts` | 281 | Rewrite — same React root pattern |
| `core/ui/TscnPreviewUI.ts` | ~300 | Rewrite or kept if canvas overlay pattern preserved |
| `core/SceneSetup.ts` | ~100 | Deleted — R3F `<Canvas>` handles this |

**Total imperative rendering code at risk**: approximately 4,400–4,700 LOC.

Files that survive but shrink: `core/NodeTracker.ts` (lookup cache role), `core/ResourceRecoveryManager.ts` (logic moves to hooks).

---

## 3. Reconciliation Work That Disappears

| Work Item | Status | With R3F |
|---|---|---|
| WI-78.1: Immutable SceneGraph Model | Done | **Kept** |
| WI-78.2: Scene Resolution & Flattening | Done | **Kept** |
| WI-78.3: Hierarchy Registry | Done | **Shrunk** — becomes React context |
| WI-78.4: Dependency Tracking | Done | **Kept** — nodeDependsOnPath survives |
| WI-78.5: Reconciliation Engine | Not done | **Deleted** — React's reconciler does this |
| WI-78.6: Panel Integration | Not done | **Deleted** — no TscnRenderer to wire |
| WI-77.1: Selective Update Strategies | Not done | **Shrunk** — `useMemo` + key-based identity handles most |
| WI-77.2: Property Diffing Utility | Not done | **Deleted** — React diffs internally |
| WI-77.4: VSCode File Watcher Integration | Not done | **Kept** — host-app concern |

---

## 4. Testing Impact

### What Breaks

Tests holding imperative references or mutating then reading `THREE.Scene`:

- **`TscnRenderer.test.ts`**: 780 LOC. Also has a field-name mismatch: uses `subResources` throughout but the actual `TscnScene` field is `internalResources` — these tests have latent type errors right now.
- **`NodeLifecycleManager.test.ts`**: Entire file disappears when `NodeLifecycleManager` is deleted.
- **`ResourceRecoveryManager.test.ts`**: Imports `SceneData` from `./types` — file does not exist. Constructs `NodeLifecycleManager(nodeTracker)` with one argument — constructor requires `(scene, nodeTracker)`. These are confirmed type errors on the current branch.
- **`renderer.test.ts` files for all 9 node types**: 36 files call `toBeInstanceOf(THREE.Mesh)` etc. by invoking renderer functions directly. Would become `@react-three/test-renderer` assertions.
- **Integration tests using `getSceneForTesting()`**: 6 files (`renderPipeline.integration.test.ts`, `SceneManager.external-rendering.test.ts`, `camera3d.integration.test.ts`, `SceneManager.nested-external.test.ts`, `TscnRenderer.worldenvironment.test.ts`).

Estimated tests affected: 150–200 out of ~3,700 total. Parser/linter tests (the majority) are untouched.

### What Gets Better

`@react-three/test-renderer` provides a synchronous in-memory renderer:

- No `canvas` mock or `setupThreeJsScene` mock required
- `toGraph()` snapshot tests replace fragile instance-type assertions
- `act()` pattern makes async resource loading testable without `vi.waitFor` polling
- Handler accumulation tests (the 100-line `Event Handler Accumulation Bug` suite in `meshinstance3d/renderer.test.ts`) become unnecessary — React's component lifecycle prevents accumulation by design

### Concrete Before/After: `meshinstance3d/renderer.test.ts`

**Current approach** (imperative, from the actual test file at line 54–84):

```typescript
import * as THREE from 'three';
import { createMeshInstance3D } from './renderer';

it('should create a THREE.Mesh', () => {
  const properties: MeshInstance3DProperties = {
    name: 'TestMesh',
    surfaceMaterialOverrides: new Map(),
  };
  const mesh = createMeshInstance3D('TestMesh', properties);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
});

// Testing async material application requires vi.waitFor polling:
it('should apply materialOverride', async () => {
  const mesh = createMeshInstance3D('TestMesh', properties, mockScene as any);
  await vi.waitFor(() => {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat?.userData.isPlaceholder) throw new Error('still placeholder');
  }, { timeout: 100 });
  expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
});
```

**R3F approach** (declarative, with `@react-three/test-renderer`):

```tsx
import { create, act } from '@react-three/test-renderer';
import { MeshInstance3DComponent } from './Component';

it('should render a THREE.Mesh', async () => {
  const renderer = await create(
    <MeshInstance3DComponent name="TestMesh" surfaceMaterialOverrides={new Map()} />
  );
  expect(renderer.scene.findByType('Mesh')).toBeDefined();
});

it('should apply materialOverride via act()', async () => {
  let renderer;
  await act(async () => {
    renderer = await create(
      <MeshInstance3DComponent
        name="TestMesh"
        mesh='SubResource("BoxMesh_1")'
        materialOverride='SubResource("StandardMaterial3D_red")'
        scene={mockScene}
      />
    );
  });
  const mesh = renderer.scene.findByType('Mesh');
  expect(mesh.props.material.color.getHex()).toBe(0xff0000);
});
```

---

## 5. Bundle / Performance Cost

Current webview bundle: 1.4 MB.

| Package | Approx uncompressed | Approx gzipped |
|---|---|---|
| `react` + `react-dom` (v19) | ~130 KB | ~42 KB |
| `@react-three/fiber` (v9) | ~200 KB | ~60 KB |
| `@react-three/drei` (optional) | ~250 KB (tree-shaken) | ~70 KB |
| **Total delta** | **~580 KB** | **~172 KB** |

Approximately 40% gzip footprint increase over current bundle. In the VS Code webview context this loads once and caches; runtime performance impact is negligible.

---

## 6. Migration Strategy Options

### (a) Incremental — Wrap then Port

Wrap existing `TscnRenderer` inside `<Canvas>` root while porting node renderers one type at a time.

**Pros**: Lower risk to the 3,500+ unaffected tests; can ship partial wins.  
**Cons**: The integration seam between the old `NodeLifecycleManager` and R3F's reconciler is architecturally awkward — both want to own the THREE.Scene. This seam is the hardest part. Incremental migration extends how long this awkwardness lasts.

### (b) Big-Bang — Restart on `main` + R3F

Reset to `main`, adopt R3F, port all nine renderer.ts files to Component.tsx, rewrite `TscnRenderer`, remove `NodeLifecycleManager`.

**Pros**: Clean, no dual-path seam. The event resource pipeline (FileEventBus → ResourceEventBus → ResourceLoader) was built on `main` and survives. The immutable SceneGraph model can be cherry-picked or replicated cleanly.  
**Cons**: Large batch of changes. Testing during transition is harder — mid-migration, nothing fully works. Requires discipline to not re-introduce the same bugs.

### (c) No Migration — Borrow R3F's Reconciler Design Without React

**Verdict: Worst outcome.** This is WI-78.5 as already written. Produces a bespoke reconciler with no ecosystem testing tooling. Do not do this.

---

## 7. Alternatives Newer Than R3F

### solid-three

SolidJS-based, no VDOM, fine-grained reactive signals. API mirrors R3F closely. Bundle delta smaller (~100 KB gzipped). Testing ecosystem is thin: `solid-testing-library` exists but no `solid-three-test-renderer` equivalent to `@react-three/test-renderer`.

**Repository**: https://github.com/solidjs-community/solid-three  
**Test tooling status**: As of May 2025, there is no `solid-three-test-renderer` package and no open issue or discussion proposing one on the solid-three GitHub. `solid-testing-library` can render SolidJS components to the DOM but does not provide synchronous THREE.js scene graph traversal (no `findByType()`, no `toGraph()`).

**Realistic likelihood**: Low, within a 12-month horizon. solid-three is maintained but community-driven; test renderer tooling requires a sustained contributor investment that has not started.

### Threlte (Svelte 5 + runes)

Svelte 5 rune-based reactivity is well-suited for reactive scene graphs. Threlte v7 targets Svelte 5.

**Repository**: https://github.com/threlte/threlte  
**Test tooling**: `@threlte/test` exists as a package and provides `render()`, `cleanup()` helpers via `@testing-library/svelte`. It does NOT provide synchronous THREE.js scene graph inspection. `@threlte/test` exposes the Threlte context (scene, camera, renderer) via `getThrelteContext()`, allowing you to query `context.scene.children` — but this is the live THREE.js scene, not a virtual snapshot, and it requires Svelte's async `tick()` rather than `act()`. Additionally, Svelte components require a Svelte compiler in the build chain, which this monorepo does not have.

**Realistic likelihood**: Moderate as a testing path, but it requires adding a Svelte compiler, which is a significant tooling change. Not appropriate for this codebase without a deliberate decision to adopt Svelte as the UI framework.

### TresJS (Vue 3)

Vue 3 composables wrapping THREE.js. `@tresjs/test-utils` exists.

**Repository**: https://github.com/Tresjs/tres  
**Test tooling**: `@tresjs/test-utils` provides `mount()` and access to `context.scene` — similar to Threlte, exposes live THREE.js scene, not a virtual snapshot. No `findByType()` or `toGraph()` equivalent. Also requires Vue 3's template compiler in the build chain.

**Realistic likelihood**: Same constraint as Threlte. Not appropriate without adopting Vue as the UI framework.

**Honest verdict**: None of these alternatives beats R3F for the specific problem of "better testing." `@react-three/test-renderer` is the only tool in this space that provides synchronous scene graph traversal, `toGraph()` snapshots, and `act()` integration. If that testing story matters, R3F is the only current option that provides it.

### What would have to be true for the non-React path to win

For **solid-three**: A `solid-three-test-renderer` package would need to ship, providing synchronous `findByType()` traversal and `toGraph()` snapshots equivalent to `@react-three/test-renderer`. Watch the [solid-three GitHub issues](https://github.com/solidjs-community/solid-three/issues) for any discussion of a test renderer. As of this writing, no such discussion exists.

For **Threlte**: `@threlte/test` would need to add synchronous scene graph inspection (a `toGraph()` equivalent that does not require async `tick()`), and this repo would need Svelte added to its build chain. The second condition is a deliberate tooling choice, not just a package install. Watch for `@threlte/test` major version bumps that mention synchronous traversal.

For **TresJS**: Same signal as Threlte: `@tresjs/test-utils` would need synchronous scene graph inspection, and Vue would need to be in the build chain.

---

## 8. Recommendation (Revised)

**Proceed with Path B: restart on `main`, adopt R3F.**

This is a reversal of the initial recommendation. Here is the honest accounting.

### Branch state audit findings

The current `claude/plan-event-foundation-*` branch has the following confirmed issues:

1. **`packages/textscene-core/src/core/ResourceRecoveryManager.test.ts:14`**: imports `SceneData` from `'./types'` — file does not exist. TypeScript compile error.
2. **`packages/textscene-core/src/core/ResourceRecoveryManager.test.ts:29`**: constructs `NodeLifecycleManager(nodeTracker)` with one argument — constructor signature is `(scene: THREE.Scene, nodeTracker: NodeTracker)`. TypeScript compile error.
3. **`packages/textscene-core/src/core/TscnRenderer.test.ts`**: uses `subResources` field in ~20 `TscnScene` literals — the actual field name is `internalResources`. Type errors throughout this file.
4. **`apps/textscene-vscode/src/webview/webview.ts:267`**: comment reads "Simple First: full re-render on updates (no incremental reconciliation)". Incremental reconciliation is explicitly not wired up.
5. **`apps/textscene-vscode/src/TscnPreviewPanel.ts:200-203`**: comment acknowledges `updateScene` triggers a full re-render despite sending diff metadata. The diff machinery in `diffUtils.ts` is complete, but the webview ignores the changes payload.

The reconciliation layer (the core of Phase 13.5) was never connected to the rendering layer. The incremental update infrastructure is scaffolded but not functional. This matches the user's description.

### Three paths, honest comparison

**Path A: Stay-and-finish** — fix the broken tests, wire up the diff to the webview, implement WI-78.5 (ReconciliationEngine) and WI-78.6 (Panel Integration), implement WI-77.1 (Selective Update Strategies).

- Fix cost: correct the 3 broken test files, wire `changes` payload from `updateScene` into the webview renderer (~50–100 lines)
- Build cost: WI-78.5 (ReconciliationEngine ~200 LOC) + WI-78.6 (integration ~100 LOC) + WI-77.1 (~200 LOC)
- Total estimated new work: moderate complexity
- Risk: you own the reconciler forever; subtle correctness bugs in custom diffing are hard to test; the test files that were stale may signal deeper drift between implementation and tests
- Preserves: all the Phase 13.5 WI-78.x work completed so far; event resource pipeline

**Path B: Restart on `main` + R3F** — discard the broken branch entirely, start from `main`, adopt R3F as the rendering layer from the first commit.

- Salvageable from the branch: `SceneGraph.ts`, `SceneGraphBuilder.ts`, `nodeDependsOnPath.ts`, the resource pipeline (WI-79), `diffUtils.ts` — cherry-pick these ~4 files
- Build cost: WI-R3F-1 through WI-R3F-4 (see Section 9) — complex overall, but each WI is self-contained and testable
- Risk: R3F introduces React as a runtime dependency; bundle grows ~172 KB gzipped; some THREE.js-specific patterns need R3F equivalents (OrbitControls, CameraHelper)
- Gain: reconciliation deleted (not built); handler-accumulation bugs structurally impossible; testing story materially better; the three known broken items on the current branch don't need to be fixed

**Path C: Restart on `main` + Phase 13.5 redo** — discard the broken branch, redo Phase 13.5 with no R3F.

- Cherry-picks same as Path B
- Build cost: same as Path A (fix/build WI-78.5, WI-78.6, WI-77.1) but starting from a clean baseline
- Risk: same long-term ownership of a custom reconciler; same testing story (no improvement)
- Advantage over Path A: avoids inheriting the stale test files and wiring debt; modern LLM capabilities do make a difference on implementation quality

**The deciding question**: Is the custom reconciler (WI-78.5) worth owning? If you believe it is — because you want zero React dependency, or because you plan to port to a different framework later — Path C is correct. If you accept React as a dependency, Path B is clearly better: it delivers the reconciler for free via React, improves testing, and removes the most complex remaining work items.

The "started months ago with worse models" observation is a real tailwind for any restart path. It is not a technical argument, but it is a practical one: implementation quality on a redo will likely be higher. This favors both Path B and Path C over Path A.

**Final call: Path B.** The branch is not load-bearing. R3F deletes the hardest remaining work. The testing story is the user's stated primary concern, and R3F is the only current option that addresses it materially.

---

## 9. Work Item Breakdown for Path B

**Cherry-pick from current branch first:**
- `packages/textscene-core/src/core/SceneGraph.ts`
- `packages/textscene-core/src/core/SceneGraphBuilder.ts`
- `packages/textscene-core/src/core/nodeDependsOnPath.ts`
- `apps/textscene-vscode/src/diffUtils.ts`
- Full `packages/textscene-core/src/resources/` directory (WI-79 event pipeline)

**New WIs (replacing WI-78.5, WI-78.6, WI-77.1):**

**WI-R3F-1: R3F Infrastructure Setup** (moderate)
- Add `react`, `react-dom`, `@react-three/fiber` to pnpm catalog
- Create `<TscnCanvas>` root component accepting `SceneGraph` prop
- Validate `<Canvas>` mounts in web app and VS Code webview
- Acceptance: `pnpm type-check` passes; dev server loads blank scene

**WI-R3F-2: Port Leaf Node Renderers to Components** (moderate)
- Convert each `nodes/**/renderer.ts` to `nodes/**/Component.tsx`
- One node type at a time; keep old renderer.ts until component is validated
- Tests use `@react-three/test-renderer` — `findByType()` replaces `toBeInstanceOf(THREE.*)`
- Acceptance: all renderer tests pass with test-renderer; bundle builds

**WI-R3F-3: Replace TscnRenderer and NodeLifecycleManager** (complex)
- Remove `TscnRenderer` and `NodeLifecycleManager` entirely
- SceneGraph drives component tree reactively via props
- ResourceEventBus subscriptions move into React effects in components
- Acceptance: hot-reload works; camera state preserved; integration tests pass

**WI-R3F-4: Multi-Panel and VSCode Integration** (moderate)
- Replace HierarchyRegistry with React context
- Update both app entry points to mount React root
- Camera state via React refs; OrbitControls via `@react-three/drei`
- Acceptance: two panels open simultaneously; each updates independently

**If choosing Path C instead (no R3F):**
- Same cherry-picks
- WI-78.5: ReconciliationEngine (ReconciliationEngine.ts, PropertyDiffer.ts)
- WI-78.6: Wire reconciler into rendering (replace `performRender` with reconcile-then-apply)
- WI-77.1: Selective Update Strategies (property-level diffing on top of WI-78.5)
- WI-77.4: VSCode File Watcher Integration (host-app, independent)
