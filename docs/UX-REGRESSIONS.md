# UX regressions on `feat/r3f-migration` vs `main`

Code-archaeology snapshot comparing `main` (HEAD `80fa99e`) with `feat/r3f-migration` (HEAD `ed642ac`). Three regressions the original `PARITY-AUDIT.md` missed because it scanned per-node-type properties, not cross-cutting app-shell features.

All `main:` references are accessed via `git show main:<path>`.

---

## Regression 1: Show/hide button has no effect on the 3D scene

### Main behavior (pre-migration)

- `main:packages/textscene-core/src/ui/SceneTreeViewer.ts` — `class SceneTreeViewer` holds `hiddenNodes: Set<string>` (L24), `toggleNodeVisibility` (L100), `isNodeVisible` with ancestor-walk (L88). Emits `onNodeVisibilityChange(nodePath, visible)` callback.
- `main:packages/textscene-core/src/ui/TscnPreviewUI.ts:67-73` wires the callback to `this.renderer.setNodeVisibility(path, visible)`.
- `main:packages/textscene-core/src/core/TscnRenderer.ts:331` delegates to `nodeLifecycle.setNodeVisibility`, which at `main:packages/textscene-core/src/core/NodeLifecycleManager.ts:485` does `nodeTracker.getObject(path).visible = visible`.
- Wire flow: TreeNode click → local set toggle → callback → `TscnRenderer` → `NodeLifecycleManager` flips `THREE.Object3D.visible`. Tree row also gets a `hidden` CSS class for dimming.

### What feat/r3f-migration does instead

- `packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.tsx:41` — `hiddenNodePaths` is a `useState` *local to this component*, and `handleToggleVisibility` (L67-77) only mutates that set. Set is passed to `TreeNode` for CSS dimming (L136).
- `packages/textscene-core/src/r3f/components/SceneTreeViewer/TreeNode.tsx:178-186` — the eye button calls `onToggleVisibility(nodePath)`.
- The set is never read by `NodeDispatcher.tsx` or any node component under `packages/textscene-core/src/r3f/nodes/`. No context surfaces it.
- Why it doesn't work end-to-end: the visibility set is SceneTreeViewer-local; nothing connects it to the dispatcher that mounts THREE objects.

### Fix surface area

- **Edit** `packages/textscene-core/src/r3f/contexts/SelectionContext.tsx` (or add a new `VisibilityContext`) — store `hiddenNodePaths` + `toggleHidden(path)`.
- **Edit** `SceneTreeViewer.tsx:41` + `TreeNode.tsx` — move state to context, drop the local `useState`.
- **Edit** `packages/textscene-core/src/r3f/NodeDispatcher.tsx` — consume context, wrap each `DispatchedNode` subtree in `<group visible={!isHidden}>`. THREE short-circuits hidden subtrees, so ancestor-hide semantics fall out for free.

---

## Regression 2: Selected node has no visual highlight in the 3D scene

### Main behavior (pre-migration)

- `main:packages/textscene-core/src/core/HelperManager.ts` — `class HelperManager`, `highlightNode(nodePath)` at L120, `clearHighlight()` at L128, `showHoverEffect()` at L134. Internal `setHelper(key, nodePath, color)` (L34) picks one of two strategies: if the target has a `userData.getHighlightTarget()` returning a mesh with `material.color`, swap the color in place and remember the original via `coloredHelpers: Map<…, ColoredHelperState>`; otherwise wrap target in a `THREE.BoxHelper` parented to the scene.
- `main:packages/textscene-core/src/core/TscnRenderer.ts:357` delegates to `helperManager.highlightNode`.
- `main:packages/textscene-core/src/ui/TscnPreviewUI.ts:67-73` (tree click) and L91 (`setupViewportSelection`, canvas raycast) both call `renderer.highlightNode(path)`.
- Wire flow: tree row click OR canvas raycast → `TscnPreviewUI.onNodeSelect` → `renderer.highlightNode` → `HelperManager.setHelper('highlight', …)` adds green (0x00ff00) `BoxHelper` to the scene, or color-swaps the gizmo.

### What feat/r3f-migration does instead

- `packages/textscene-core/src/r3f/contexts/SelectionContext.tsx` stores `selectedNodePath`. `setSelectedNodePath` is wired in `TreeNode.tsx:69-95` and `useViewportSelection.tsx`.
- Grep of `selectedNodePath` under `packages/textscene-core/src/r3f/nodes/` returns ZERO files. `NodeDispatcher.tsx` doesn't consume `useSelection()` either. Only `NodeDetailsPanel` reads it.
- Why it doesn't work end-to-end: state is captured and the details panel updates, but nothing reaches the THREE scene graph — no BoxHelper, no material recolor, no outline pass.

### Fix surface area

- **New file** `packages/textscene-core/src/r3f/components/SelectionHighlight.tsx` — child of `<TscnCanvas>` that reads `useSelection()`, looks up the node's `THREE.Object3D` in a ref-map, and renders `<primitive object={boxHelper}>` on it.
- **Edit** `packages/textscene-core/src/r3f/NodeDispatcher.tsx` — register each dispatched node's `THREE.Object3D` into a context-provided ref-map keyed by `nodePath`, so `SelectionHighlight` can resolve `selectedNodePath → Object3D`.
- **Edit** `packages/textscene-core/src/r3f/TscnCanvas.tsx` — mount `<SelectionHighlight />` inside the `<Canvas>` tree. Optionally restore main's gizmo-color-swap branch later by having individual node components read their own selection state and recolor their helper arrows.

---

## Regression 3: Missing-files-list aggregate panel is gone

### Main behavior (pre-migration)

- `main:apps/textscene-web/src/main.ts` — module-scope `missingResourcesMap: Map<string, MissingResource>` (L44), `updateResourceFilesList()` (L46), `addMissingResourceToUI(resource)` (L139). Renders DOM into `#resource-files-list` (queried at L23): one row per uploaded file (`✓` + path + Remove) and one row per missing file (`⚠` + path + per-row `<input type="file">`).
- `main:packages/textscene-core/src/ui/TscnPreviewUI.ts` accepts `onResourceNeeded: ResourceNeededCallback` (L33); `TscnRenderer` is constructed with it at L46. The renderer invokes the callback whenever `ResourceProvider.getResource(path)` returns null/undefined.
- main.ts L154: `onResourceNeeded: async (resource) => { addMissingResourceToUI(resource); return null; }`. Per-row upload handler at L113 does `provider.addUploadedFile(path, file)` → `renderer.provideResource(resource.path)` → re-runs dependent resources, deletes the row.
- DOM: `#resource-files` panel toggled via `.visible`; uploaded-first / missing-second grouping; per-row file `<input>` so the user picks a file *for the specific path the scene needs*.

### What feat/r3f-migration does instead

- `apps/textscene-web/src/main.ts` is 17 lines (just `mountR3F`). UI lives in `apps/textscene-web/src/r3f-main.tsx`.
- `r3f-main.tsx:130-176` — single global `<input type="file" multiple>`. Uploaded filenames are *guessed* into paths (`res://textures/<name>` for images, else `res://<name>`, L114). No knowledge of which paths the scene actually references.
- Per-node placeholders: `packages/textscene-core/src/r3f/NodeDispatcher.tsx:188` (`<InstancePlaceholder label="Missing scene: …">`), `r3f/nodes/sprite3d/Component.tsx:130`, `r3f/nodes/meshinstance3d/Component.tsx:181`. Each is hook-local — magenta cube in the 3D scene, no aggregate.
- `packages/textscene-core/src/resources/FileEventBus.ts` only emits `'loaded'` / `'failed'` (no `'missing'` event). `useResource` (`useResource.ts:23`) does surface per-call `status: 'missing'`, but nothing subscribes to it across all consumers.
- Why it doesn't work end-to-end: no upstream aggregation. User sees magenta cubes but no list of which paths to upload, and the toolbar input is path-guessing rather than path-targeted.

### Fix surface area

- **New file** `packages/textscene-core/src/r3f/contexts/MissingResourcesContext.tsx` — exposes `Set<string>` of missing paths and `report(path)` / `clear(path)`.
- **Edit** `packages/textscene-core/src/resources/useResource.ts` — when `status` flips to `'missing'` call `report(path)` in an effect; clear on `'loaded'` or unmount.
- **New file** `packages/textscene-core/src/r3f/components/MissingResourcesPanel/MissingResourcesPanel.tsx` — subscribes to the context and mirrors main's `updateResourceFilesList` DOM (uploaded ✓ + missing ⚠ rows, per-row `<input type="file">`).
- **Edit** `apps/textscene-web/src/r3f-main.tsx` — wrap shell in `<MissingResourcesProvider>`, mount `<MissingResourcesPanel>`, and replace the global filename-guessing input with the per-row handlers from the panel calling `provider.addUploadedFile(rowPath, file)` + `loader.provideFile(rowPath)`.

---

## Methodology gap — why the original PARITY-AUDIT.md missed all three

The existing `docs/PARITY-AUDIT.md` is organized **per node type** (`Node3D.visible`, `MeshInstance3D.mesh`, `Camera3D.fov`, …). Each row asks: *"does the new code read this TSCN property?"* All three regressions above are **cross-cutting app-shell features** that have no TSCN property to scan for:

- Show/hide is a *runtime UI affordance* on the SceneTreeViewer, not a property on any node.
- Selection highlight is a *cross-cutting rendering decoration* applied to whichever node the user picks, not a node-owned property.
- Missing-resource aggregation is an *application-level UI panel*, not a property of any node.

A per-node-type audit is structurally blind to these. The audit checked every leaf the migration carried over; it never asked which *app-shell capabilities* main had that the migration had to re-implement.

### How a future audit should change

In addition to the per-node-type pass, add an **app-shell capability inventory** pass:

1. List the host applications' top-level public capabilities by reading `apps/<host>/src/main.ts` and `packages/textscene-core/src/ui/*` on the pre-migration commit. Each interactive UI element is a row.
2. For each row, name the source/sink: which user action fires it, what state it mutates, what DOM or 3D primitive it ultimately touches.
3. For the migration, find the equivalent context/component/effect chain. Mark missing chains as silent drops — same way the per-node audit marks silent property drops.

Concretely: a row "Show/hide visibility toggle" with source = TreeNode click and sink = `THREE.Object3D.visible`, audited against the migration, would have surfaced this regression immediately because the search for "what flips `.visible` based on a tree-row click" returns empty under `packages/textscene-core/src/r3f/`.

Same shape works for selection highlight (source = tree click / raycast, sink = scene-graph decoration), missing-resources (source = `useResource` reporting `'missing'`, sink = aggregated DOM list), and any future cross-cutting affordance: parse-error banner, hover effect, camera switch button, double-click reveal callback. The audit dimension is **"capability chain"**, not "node property".
