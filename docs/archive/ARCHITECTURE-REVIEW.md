# Architecture Review — feat/r3f-migration UX-fix cycle

Reviewed by: architect-2
Scope: UX-regression WIs (UX-1 through UX-10) layered on top of R3F migration
Branch state: feat/r3f-migration @ fc137e1

---

## 1. Summary Verdict

The migration's design is holding up. The core invariants — per-panel context isolation, vertical slicing for node types, CSS token system — are all intact and correctly applied. The most significant structural change in this cycle is that `SelectionContext` absorbed three new responsibilities (visibility state, THREE.Object3D ref-map, and scene-change clearing), growing from 5 to 13 exported members. That growth is coherent — all members describe per-panel *node-interaction* state — but it is approaching the limit where a single context is easy to reason about. The ref-map responsibility is the outlier worth watching. No correctness issues were found. The scene-change reset (`SceneChangeResetter` at TscnPreviewShell line 141, verified in `be56fc9`) is implemented correctly. The headline recommendation is: ship with one trivial pre-merge comment and address the remaining items post-merge.

---

## 2. Findings

### F-1: SelectionContext cohesion — approaching boundary but not over it

**Smell:** `SelectionContext` now owns:
- `selectedNodePath` / `setSelectedNodePath`
- `hoveredNodePath` / `setHoveredNodePath`
- `expandedNodePaths` / `toggleExpandedNodePath` / `setExpandedNodePaths`
- `hiddenNodePaths` / `toggleHidden` / `clearHidden`
- `nodeObjectMap` (mutable `Map<string, THREE.Object3D>`) / `registerNodeObject` / `unregisterNodeObject`

**Files:** `packages/textscene-core/src/r3f/contexts/SelectionContext.tsx` lines 19–43

**Risk:** Maintainability. The first four groups (selection, hover, expansion, visibility) are all "tree panel state" and belong together — they change in response to the same user gestures and need to be reset together on scene change. The fifth group (`nodeObjectMap`) is different in character: it is a mutable escape hatch, mutated imperatively by a `useCallback` ref callback in `NodeDispatcher` rather than driven by React state. It leaks a non-React concern (THREE.Object3D lifetime) into a pure-React context.

**Risk of leaving it:** Low in the short term. The ref-map today has exactly two consumers (`SelectionHighlight` reads it, `NodeDispatcher` writes it). If a `HoverHighlight` is added (WI-UX-10 per the roadmap) it will also read it — that is the natural third consumer that justifies the current placement. Risk escalates if the map starts being accessed from many unrelated locations (camera switcher, animation player, future WIs).

**Proposed fix:** No change pre-merge. For the next sprint: document the invariant in `SelectionContext.tsx` — the ref-map is the single bridge between THREE objects and React paths; nothing except `NodeDispatcher` (writer) and `*Highlight` components (readers) should touch it. A future refactor could extract `{ nodeObjectMap, registerNodeObject, unregisterNodeObject }` into a sibling `NodeObjectMapContext` if a fourth unrelated consumer appears. Wait for that occurrence before splitting (Rule of Three).

**Cost:** N/A (no change now)
**When to fix:** Document invariant pre-merge; split on third unrelated consumer.

---

### F-2: Provider stack depth — 4 providers is acceptable, ordering is correct

**Smell:** `TscnPreviewShell` mounts four providers in a fixed order:
```
HierarchyProvider
  SelectionProvider
    CameraControlProvider
      MissingResourcesProvider
```

**Files:** `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx` lines 137–170

**Risk:** Low. The nesting is ordered correctly — outer providers own state that inner providers depend on (`HierarchyProvider` must be outermost because `SelectionContext`'s future scene-change reset effect will depend on `sceneGraph`). Each provider is single-purpose. There is no cross-context circular dependency.

**Proposed fix:** No change. The commonly cited concern about "provider hell" applies when a provider tree grows >6 deep with no clear ownership. Four providers, each with a distinct contract, is within normal React composition. If WI-UX-7 adds a `SceneInfoCard` that needs a fifth provider for reset-camera state, fold `resetCamera` into `CameraControlContext` instead — the context already has `switchToCamera` / `returnToFreeView` and `resetCamera` belongs with that group semantically. Do not add a fifth provider.

**Cost:** N/A
**When to fix:** Prevent a fifth provider by folding `resetCamera` into `CameraControlContext` in WI-UX-7.

---

### F-3: SelectionHighlight / HoverHighlight duplication — pre-merge guidance needed

**Smell:** `SelectionHighlight` (lines 27–69, `SelectionHighlight.tsx`) uses `useThree`, a `useRef<THREE.BoxHelper>`, a `useEffect` for lifecycle, and `useFrame` for per-tick update. The pending `HoverHighlight` (WI-UX-10 per the roadmap) will be a near-clone.

**Files:** `packages/textscene-core/src/r3f/components/SelectionHighlight.tsx`
`packages/textscene-core/src/r3f/components/HoverHighlight.tsx` (not yet landed)

**Risk:** Correctness risk if both components independently attach helpers to the same scene graph node. Two `BoxHelper` instances on the same target will fight for the same bounding box on every `useFrame` tick. Performance risk is negligible; visual risk is a doubled-outline artifact.

**Proposed fix:** When `HoverHighlight` lands, extract a `useBoxHelper(target: THREE.Object3D | null, color: number)` hook encapsulating the `useRef / useEffect / useFrame` pattern. Both `SelectionHighlight` and `HoverHighlight` call it. The hook is ~30 lines; each highlight component becomes ~10 lines. This satisfies Rule of Three (two consumers using identical pattern) without a JSX abstraction layer.

The two helpers are safe to coexist simultaneously — `SelectionHighlight` uses `0x00ff00` (green) and `HoverHighlight` uses orange. They attach separate `BoxHelper` instances under different `helper.name` values. The only conflict would be if both fired for the same path, which cannot happen given `selectedNodePath` and `hoveredNodePath` are independent state slots.

**Cost:** Simple (extract 30-line hook)
**When to fix:** Pre-merge or immediately when HoverHighlight is authored. Not a blocker for PR #48 if HoverHighlight lands after.

---

### F-4: useResource missing-aggregation effect — coupling is correct, one latent risk

**Smell:** `useResource.ts` (lines 221–243) contains a second `useEffect` that calls `missingResources.report(path)` / `missingResources.clear(path)` based on `result.status`. The effect deliberately destructures `reportMissing` and `clearMissing` from the context object rather than subscribing to the full object, with an explicit comment explaining this avoids an infinite render loop.

**Files:** `packages/textscene-core/src/resources/useResource.ts` lines 221–243
`packages/textscene-core/src/r3f/contexts/MissingResourcesContext.tsx`

**Risk:** The current implementation is correct. The subtle invariant to preserve: `report` and `clear` must remain stable `useCallback` references across renders — they currently are, because `MissingResourcesProvider` wraps both in `useCallback(…, [])` with empty dependency arrays (lines 70–88 of `MissingResourcesContext.tsx`). If someone adds a dependency to either callback (e.g. for logging), the infinite loop the comment describes will silently re-emerge. This is not a bug today but is a fragile coupling that has no test guard.

The `markUploaded` → remove-from-missingPaths path in `MissingResourcesContext` (lines 90–104) requires two `setState` calls in sequence. In React 18 with automatic batching this is safe — both updates batch into one render. No race condition.

**Proposed fix:** Add a comment to both `report` and `clear` callbacks in `MissingResourcesContext.tsx` noting "must stay stable (empty deps) — `useResource`'s effect depends on identity stability". No runtime change needed.

**Cost:** Trivial
**When to fix:** Pre-merge. A comment is a five-second change that protects a non-obvious invariant.

---

### F-5: TscnPreviewShell composition — kitchen-sink concern is overstated

**Smell:** `TscnPreviewShell` handles parse pipeline, 4 providers, layout (canvas + sidebar + toolbar + panels), and conditional rendering branches for error/empty/loaded states.

**Files:** `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx`

**Risk:** Low. The file is ~172 lines total and reads cleanly. The layout structure (canvas-left, sidebar-right, panels stacked in sidebar) is direct CSS composition that belongs here. A `<PreviewLayout>` / `<PreviewProviders>` split would add two new files and an extra import chain for no behavioral gain at current scale.

The one place that is slightly awkward: the `toolbar` slot is a raw `ReactNode` injection at the top of the shell. This is fine for the web app but will become a source of per-host divergence as VS Code adds its own toolbar actions (WI-UX-7 `SceneInfoCard`). When WI-UX-7 lands, prefer adding `sceneInfo?: ReactNode` as a second slot over making `toolbar` handle everything — keep slots narrow.

**Proposed fix:** No structural change. Add a `sceneInfo` slot when WI-UX-7 lands.
**Cost:** N/A
**When to fix:** WI-UX-7 implementation time.

---

### F-6: CSS Modules and design token system — solid, two minor leaks

**Smell:** All component CSS files use `--tsi-*` tokens exclusively. Two raw non-token values were found:

1. `TscnPreviewShell.module.css` line 151: `color: #ffeaea;` with a `/* TODO(wave-2): */` comment
2. `SceneTreeViewer.module.css` line 229: `color: #777;` with a `/* TODO(wave-2): tokenize */` comment
3. `NodeDetailsPanel.module.css` line 97: `color: #ffe599;` with a `/* TODO(wave-2): derive via color-mix */` comment

These are intentionally deferred with explicit TODO markers. No ad-hoc hex values were found without a marker. The design token system is holding up.

**Files:**
`packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.module.css:151`
`packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.module.css:229`
`packages/textscene-core/src/r3f/components/NodeDetailsPanel/NodeDetailsPanel.module.css:97`

**Risk:** Very low. All three are labeled. VS Code theme integration (`--vscode-*` fallback chain) is correctly applied to every semantic token that has a VS Code analog. Tokens without a VS Code analog (type-badge palette, spacing, radii) stay as raw values, which is architecturally correct — the comment in `TscnPreviewShell.module.css` lines 17–21 documents this explicitly.

**Proposed fix:** No change pre-merge. Address in wave-2 as the TODOs already indicate.
**Cost:** Simple when addressed
**When to fix:** Wave-2 UI pass.

---

### F-7: WI-UX-5 scene-change reset — VERIFIED PRESENT (PR #55, `be56fc9`)

**Note:** Initial review was performed against a worktree snapshot that predated PR #55. `SceneChangeResetter` is confirmed present on `feat/r3f-migration` at line 141 of `TscnPreviewShell.tsx`, with regression tests in `SelectionContext.scene-change.test.tsx` and `TscnPreviewShell.scene-switch.test.tsx`. The implementation matches the `useEffect`-inside-`SelectionProvider` pattern described below.

**Shape (for reference):** An inner component `SceneChangeResetter` mounts inside `<SelectionProvider>`, reads `sceneGraph` from `useHierarchy`, and fires `setSelectedNodePath(null)` + `setHoveredNodePath(null)` + `clearHidden()` in a `useEffect` keyed on `sceneGraph` identity. This is the correct approach — it keeps the `TscnPreviewShell` render function free of hooks and lets the reset react to the provider's sceneGraph rather than the raw `content` prop (which would fire on every keystroke in a live-editing host).

**Risk:** None. Resolved.
**When to fix:** Already done.

---

## 3. Approval Recommendation

**Recommendation: ship it. One optional pre-merge comment; everything else is post-merge.**

1. **F-4 comment (5 min, optional):** Add a stability note to `report` and `clear` in `MissingResourcesContext.tsx` noting they must keep empty `useCallback` deps. Protects a non-obvious invariant at zero runtime cost. Team-lead has indicated they will add this directly — no blocker.

All correctness items are resolved (F-7 verified). All other findings are maintainability notes, future-WI guidance, or wave-2 deferred work. PR #48 can ship now.

The `HoverHighlight` deduplication guidance (F-3) should reach the WI-UX-10 implementer before they author the component, not as a merge blocker.

---

## 4. Future-Proofing Notes

**For the Animation/Audio WIs (R3F-16+):** `AnimationPlayer` will likely need to update THREE object properties imperatively on each animation tick. That pattern should NOT go through `SelectionContext`'s `nodeObjectMap` — the ref-map is for read-only highlight lookups, not write-back targets. A separate `useAnimationTarget(path)` hook that looks up the object map directly (same underlying data) is the correct boundary.

**For the VS Code extension parity work:** The `onResourceUpload` / `onResourceRemove` prop pattern on `TscnPreviewShell` is the right model for host-specific capabilities. The extension will want to wire these to VS Code's file-system API rather than an in-memory provider. Keep the shell's callback surface narrow — do not add more than two or three host-capability props before considering a `capabilities` object prop.

**On lazy loading (WI-R3F-18):** The previous main-checkout `TscnPreviewShell` used `React.lazy` for `SceneTreeViewer` and `NodeDetailsPanel`; the current worktree version does not. This is a known inconsistency between branches — the lazy-load WI should be re-applied after the UX WIs merge to preserve the bundle size benefit.

**Provider ordering discipline:** As the provider stack approaches 4–5, write the nesting order into a comment at the top of `TscnPreviewShell.tsx` (e.g., "providers ordered outermost-first; `HierarchyProvider` must be outermost because X depends on it"). This makes the ordering intentional rather than incidental and prevents future developers from reordering providers to match alphabetical preference.
