# Architecture improvement candidates — scout report

Scan tip: 05bd4d8 — date 2026-05-27

Scout: `arch-scout-4` (read-only). Main checkout.

This scan covers the post-merge tip `05bd4d8` which brings
`feat/r3f-migration` (WI-HALL-1..6 + WI-ARCH-1..3) onto the
audio/animation tip (`feat/r3f-16-audio-animation`).

Prior scan was `e10d0ca` (2026-05-21, 7 LOW / 0 MED / 0 HIGH).

---

## Sprint-1 curation items — resolution check

| Item | Prior status | Post-merge status | Notes |
|------|-------------|-------------------|-------|
| #1 PropertyValidator combinators | ACCEPT Sprint-1 | **RESOLVED** | `v.ts` (415 LOC, 22 combinators); 31 `linterParser.ts` files migrated; ~7,500 LOC removed |
| #2 ResourceLoader unification | ACCEPT Sprint-1 | **RESOLVED** | `SceneLoader.ts` deleted; `createSceneProcessor.ts` added; processors Map; compat shims retained |
| #3+#5 useTHREEHelper + MissingResourcePlaceholder | ACCEPT Sprint-1 | **RESOLVED** | `useTHREEHelper.ts` covers all 6 prior sites; `MissingResourcePlaceholder` is one component |
| #9 r3f-main toolbar CSS | ACCEPT Sprint-2 | **RESOLVED** | `r3f-main.module.css` exists; toolbar uses `styles.toolbar` not hex literals. One remaining inline `style={{ width:'100vw',…}}` is structural wrapper, not design tokens. |

Sprint-2 item #4 (`useResources` dynamic hook) and Sprint-3 items (#7, #8, #10) are unchanged and still valid.
Prior LOWs #11 (`useViewportSelection expandedRef`) still present, still LOW; the `expandedRef` + sync pattern is visible at `hooks/useViewportSelection.tsx:55-58`.

---

## NEW candidates from post-merge surface

---

### POST-1 (LOW): `resolveInstancePath` now has three independent implementations

**Where**:
- `packages/textscene-core/src/r3f/NodeDispatcher.tsx:236-247` — local private function
- `packages/textscene-core/src/r3f/components/SceneTreeViewer/useSubSceneChildren.ts:56-67` — local private function with explicit "Mirrors NodeDispatcher's" comment
- `packages/textscene-core/src/resources/ResourceLoader.ts:242-266` — **new third copy** added by WI-ARCH-2 as a public method on `ResourceLoader`

**Smell**: Prior scan (NEW-2 from 2026-05-21) identified the first two as LOW-5 drift. WI-ARCH-2 added a third — `ResourceLoader.resolveInstancePath` uses `parseReference` from `resources/processing/materialProcessing.ts` (which only handles `ExtResource`), while the other two use `parseResourceReference` from `resources/SubResourceResolver.ts` (which handles both `SubResource` and `ExtResource`). The three variants have slightly different parse helpers, different error handling, and different signatures:

- `NodeDispatcher.resolveInstancePath(instanceRef, externalResources[])` — uses `SubResourceResolver.parseResourceReference`
- `useSubSceneChildren.resolveInstancePath(instanceRef, externalResources[])` — also uses `SubResourceResolver.parseResourceReference`
- `ResourceLoader.resolveInstancePath(instanceRef?: string)` — uses `materialProcessing.parseReference` (ExtResource only); looks up in `MetadataStore`

The first two are functionally identical (12-line duplicate). The third is behaviourally different (MetadataStore lookup instead of array scan, ExtResource-only parse, logs warnings). They are NOT three implementations of the same thing — they address the same _logical operation_ but through different data sources.

**Deletion test**: delete `useSubSceneChildren.resolveInstancePath`. The hook needs to resolve an instance ref. Option (a): export `resolveInstancePath` from `NodeDispatcher.tsx`. Option (b): move to `utils/resourceReference.ts` (the prior scan's recommendation, still valid). Option (c): the hook could call `ResourceLoader.resolveInstancePath` via context — but the data source is different (MetadataStore vs `externalResources[]`), so this would couple the tree-viewer's hook to the resource loader.

**Why LOW, not MEDIUM**: the first two copies are literally identical and have no behavioral risk. The third differs by design — its presence on `ResourceLoader` is intentional for the `provideFile()` routing path. The consolidation needed is (a)+(b): pull the shared 12-line parser logic into `utils/resourceReference.ts` (this was LOW-5 + NEW-2 in the prior scan, and WI-ARCH-2 widened it by one copy rather than closing it).

**Proposed fix**: same as prior scan's recommendation — `utils/resourceReference.ts` with `parseExtOrSubResourceRef(value)` exported. `NodeDispatcher`, `useSubSceneChildren`, and `linter/resourceChecker.ts` all use it. `ResourceLoader` keeps its existing `parseReference` (ExtResource-only) since it serves a different lookup contract.

**Effort**: trivial. 4 import changes.

**Blast radius**: `SubResourceResolver.ts` can be deleted or reduced to a re-export; `resourceChecker.ts:25` inline regex is eliminated; prior LOW-5 is finally closed.

---

### POST-2 (LOW): `v.ts` inline regex validators bypass `vectorValidators.ts` for five Godot types

**Where**:
- `packages/textscene-core/src/linter/validators/v.ts:245-414` — five validators (`color`, `aabb`, `quaternion`, `transform2d`, `basis`) each define a local `const *_REGEX` and inline the parse/error logic
- `packages/textscene-core/src/linter/validators/vectorValidators.ts` — already exports `VECTOR2_REGEX`, `VECTOR3_REGEX`, `RECT2_REGEX`, `TRANSFORM3D_REGEX` as named module-level constants

**Smell**: The `vectorValidators.ts` pattern (named `EXPORT_REGEX` at module top + factory function) was applied consistently for Vector2/3/Rect2/Transform3D. WI-ARCH-1 added the remaining Godot types to `v.ts` inline instead of extending `vectorValidators.ts`. The five inline regexes are:
- `COLOR_REGEX` (4 components, same pattern as Vector4)
- `AABB_REGEX` (6 components)
- `QUATERNION_REGEX` (4 components)
- `TRANSFORM2D_REGEX` (6 components)
- `BASIS_REGEX` (9 components)

Each regex is created inside the closure that `v.color(name)` / `v.aabb(name)` etc. returns — so a fresh `RegExp` object is allocated every time a validator is built. For the 31 `linterParser.ts` files calling `v.color(...)` across 30+ node types, this means 30+ `RegExp` object allocations at module-load time. It's not a perf issue at current scale but is inconsistent with how the existing factories work.

**Why LOW**: correctness is fine; the inline approach works. The smell is inconsistency and missed re-use — `TRANSFORM3D_REGEX` is already in `vectorValidators.ts`, but `transform2d` doesn't follow the same pattern. The fix is mechanical: add 5 exports to `vectorValidators.ts`, add 5 factory functions, convert the 5 `v.xxx` entries to use them.

**Deletion test**: delete the 5 inline REGEXes from `v.ts`. Would need corresponding factory imports from `vectorValidators.ts`. No caller impact.

**Effort**: trivial (~20 LOC moved).

**Blast radius**: `v.ts` only. No callers change.

---

### POST-3 (LOW): `r3f-main.tsx` retains one structural inline style that bypasses CSS module

**Where**: `apps/textscene-web/src/r3f-main.tsx:170` — `<div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>`

**Context**: Prior candidate #9 (toolbar CSS extraction) is largely RESOLVED — `r3f-main.module.css` is in place and the toolbar uses `styles.toolbar` / `styles.resetCameraButton` etc. However, the outermost shell wrapper `<div>` that contains `<TscnPreviewShell>` still uses inline styles for the fullscreen layout.

**Why LOW**: this is the opposite smell from the prior #9 (design-token divergence). The `100vw × 100vh` values are purely structural (not design tokens) and aren't shared with the VS Code extension. The risk is minimal — it's a web-app-only wrapper div, not a shared component. The remediation is moving these 3 CSS declarations to `r3f-main.module.css` as a `.appRoot` class.

**Effort**: trivial.

**Blast radius**: `r3f-main.tsx` and `r3f-main.module.css` only.

---

## Prior candidates — re-check status

| # | Title | Status | Notes |
|---|-------|--------|-------|
| #1 (LOW-1) | ResourceLoader compat pass-throughs | **CONFIRMED STILL PRESENT but harmless** | `requestTexture`, `requestMaterial`, `getSceneCached`, `clear*Cache` shims exist in `ResourceLoader.ts:207-349`. No production callers found in `apps/` — they exist only as test-mock anchors. The file documents this explicitly. Consider dropping in a future janitor WI when test mocks are updated. |
| #2 (LOW-2) | MeshInstance3D 6-fold `useResource` + 6 `useMemo` | **UNCHANGED** | `Component.tsx:101-168` still has 6 fixed-slot `useResource` calls. This is the `useResources` hook gap (Sprint-2 #4). No change here. |
| #3 (LOW-3) | `propertyFormatter.ts` per-type files | **UNCHANGED** | 11 files, still hand-coded. Still gated on #1 landing first (per curation). #1 is now RESOLVED so the precondition is met. This is now available to schedule as Sprint-3 follow-on to #6 (Property descriptors unified table). |
| #4 (LOW-4) | `transformFromNode3DProperties` useMemo in 12 components | **COUNT GREW TO 12** | Now 12 files (added `node/Component.tsx` for WI-HALL-4 instance-node transform fix). Unchanged severity — still LOW, still Sprint-3 `useNode3DTransform` hook. |
| #5 (LOW-5 + NEW-2) | `parseResourceReference` duplication | **WIDENED** | Now 3 copies (see POST-1 above). LOW severity unchanged. |
| NEW-1 | sRGB duplication (`materialScalars.ts` vs `renderer.ts`) | **UNCHANGED** | `sRGBChannelToLinear` + `sRGBToLinearRGB` still in `materialScalars.ts`; `renderer.ts` uses `THREE.Color.convertSRGBToLinear()`. LOW unchanged. |
| NEW-3 | Expand-all doesn't walk sub-scene children | **UNCHANGED** | `SceneTreeViewer.tsx:19-27` `collectAllPaths` still only walks the inline scene graph. LOW unchanged. |
| NEW-4 | GLBSceneRoot synthesis — watch for second | **UNCHANGED** | Single-use synthesiser, clean. Watch only. |
| NEW-5 | GLBSceneRoot BoxHelper | **NEEDS VERIFICATION** | `GLBSceneRoot/Component.tsx:54` uses `<primitive object={result.value} />` directly. `NodeDispatcher` wraps this in its `wrapperRef` group. Whether `THREE.BoxHelper` computes bounding boxes including child geometry (it does via `Object3D.setFromObject()`) means this is likely a non-issue. Still unverified in the field. |
| #6 (LOW-6) | propertyFormatter = property descriptors unified | **PRECONDITION MET** | #1 (PropertyValidator combinators) is RESOLVED. This can now be scheduled per the curation note. |
| #7 | useNode3DTransform hook | **UNCHANGED** | Sprint-3, now touches 12 components instead of 8. |
| #8 | SubResourceResolver rename | **PARTIALLY IMPROVED** | `ResourceLoader.resolveInstancePath` is a new public API that further entrenches the bifurcated parse functions. Folding SubResourceResolver + utils/resourceReference is now more load-bearing. |
| #9 | r3f-main toolbar CSS | **MOSTLY RESOLVED** | One structural inline style remains (POST-3 above). |
| #10 | useParsedScene hook | **UNCHANGED** | `parseContent` is still a local function in `TscnPreviewShell.tsx:61-98`. Sprint-3. |
| #11 | useViewportSelection expandedRef | **UNCHANGED** | `useViewportSelection.tsx:55-58` unchanged. |

---

## Candidate summary

### HIGH: 0

### MEDIUM: 0

### LOW (active)

| ID | Title | Sprint target |
|----|-------|--------------|
| POST-1 | `resolveInstancePath` — now 3 copies (closes LOW-5 + NEW-2) | Janitor bundle |
| POST-2 | `v.ts` inline regex validators bypass `vectorValidators.ts` | Janitor bundle |
| POST-3 | `r3f-main.tsx` one remaining structural inline style | Janitor bundle |
| LOW-1 | ResourceLoader compat pass-throughs (no callers outside tests) | Janitor bundle (when test mocks updated) |
| LOW-2 | MeshInstance3D 6-fold `useResource` (hooks constraint) | Sprint-2 (#4 `useResources`) |
| LOW-3 | `propertyFormatter.ts` 11 per-type files (precondition #1 now met) | Sprint-3 (#6 follow-on) |
| LOW-4 | `transformFromNode3DProperties` useMemo in 12 components | Sprint-3 (#7) |
| NEW-1 | sRGB two implementations | Janitor bundle |
| NEW-3 | Expand-all misses sub-scene children | Decide-later |
| NEW-4 | GLBSceneRoot synthesis — watch | Watch only |
| NEW-5 | GLBSceneRoot BoxHelper — unverified | Investigate |

**Total active LOW: 11** (7 prior + 3 new POST items + 1 scope growth on LOW-4 count, no new MEDIUM or HIGH)

### RESOLVED since last scan: 4

| Item | Notes |
|------|-------|
| #1 PropertyValidator combinators | WI-ARCH-1 landed |
| #2 ResourceLoader unification | WI-ARCH-2 landed |
| #3+#5 useTHREEHelper + MissingResourcePlaceholder | WI-ARCH-3 landed |
| #9 r3f-main toolbar CSS (mostly) | `r3f-main.module.css` in place |

---

## Assessment

The Sprint-1 WIs (#1, #2, #3+#5) all landed cleanly with high coverage. The three ARCH WIs resolved 4 of the highest-leverage candidates from the original 11. The merged surface (WI-HALL-1..6, WI-R3F-12/13/16/19) added 3 new LOWs, all minor.

No HIGH or MEDIUM items exist on the post-merge tip. The codebase is in a healthy architectural state.

**Janitor bundle recommendation**: POST-1 (resourceReference utility) + POST-2 (v.ts regex factories) + POST-3 (inline style) + NEW-1 (sRGB consolidation) + LOW-1 (compat shims) combine naturally into one janitor WI. Estimated effort: simple. None touch test logic or breaking API surfaces.

**Sprint-2 blocker**: LOW-2 (`useResources`) remains the highest-leverage remaining item for feature parity (secondary-surface material textures). Precondition is clear.

**Decide-later items**: NEW-3 (expand-all sub-scene) and NEW-4 (GLB synthesis registry) are still correctly deferred. Neither has a second consumer yet.
