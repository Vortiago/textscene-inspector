# Main vs feat/r3f-migration — completeness delta

Cross-checked against `docs/MAIN-FEATURE-INVENTORY.md` (after this commit's amendments) and `feat/r3f-migration` HEAD `923ba7d` (`docs(ux-flow-analyst): re-verify 7 gaps on 9aed84b — all PASS`) on 2026-05-20.

This is the final completeness gate before PR #48 merge per
`team-orchestration` antipattern #10: "A feature inventory that documents
but doesn't dispatch is worthless." Every inventory row is classified
PRESENT / PARTIAL / MISSING against the migration's current state.

## Summary

- PRESENT: **16**
- PARTIAL: **4** (degraded but functional)
- MISSING: **5** (must ship before final merge — see "Items requiring action")

## Delta table

| # | Feature (per MAIN-FEATURE-INVENTORY.md section) | Status | Migration location | Gap notes | Tracking |
|---|---|---|---|---|---|
| 1 | Show/hide button on tree rows | PRESENT | `r3f/components/SceneTreeViewer/TreeNode.tsx:181-189` (visibilityIcon button) + `r3f/contexts/SelectionContext.tsx` (`hiddenNodePaths` Set + `toggleHidden`) + `r3f/NodeDispatcher.tsx:74-75,133` (`visible={!isHidden}`) | DOM and 3D visibility both wired. Eye / strikethrough-eye + `data-node-path` carry-over verified. | WI-UX-1 (dcf1323) |
| 2 | Highlight-selected (green BoxHelper) | PRESENT | `r3f/components/SelectionHighlight.tsx` (full file, `HIGHLIGHT_COLOR = 0x00ff00`) + tree row CSS class `styles.selected` on `TreeNode.tsx:88` | Color matches main (`0x00ff00`). `setFromObject` replaced with new-helper-on-change strategy. `useFrame` ticks update. | WI-UX-2 (dcf1323) |
| 3 | Missing-files-list / aggregate upload panel | PRESENT | `r3f/components/MissingResourcesPanel/MissingResourcesPanel.tsx` + `r3f/contexts/MissingResourcesContext.tsx` (no-op default when used outside provider) + `apps/textscene-web/src/r3f-main.tsx:98-105` (host wires `onUpload`/`onRemove` to `provider.addUploadedFile` + `loader.provideFile`) | DOM affordances ✓/⚠/Remove and `data-state` attrs all carried over. Uploaded-first ordering retained. `useMissingResources` hook gates render — `null` when both sets empty. | WI-UX-3 (9aed84b) — polish in WI-UX-6 |
| 4 | Scene switcher (categorized dropdown) | PRESENT | `r3f/components/ViewportSelector/ViewportSelector.tsx` (entire file — `bucketByCategory` emits `<optgroup>` blocks per category) + `apps/textscene-web/src/r3f-main.tsx:55-62, 117-122` | Implements `<optgroup>` grouping correctly (lines 75-89 of ViewportSelector.tsx). The original "Gap 5" / WI-UX-7-item-(3) is in fact already shipped. **Re-classify WI-UX-7 (3) as done.** | (ViewportSelector lands as part of WI-R3F-4) |
| 5 | Expand-all / collapse-all | PRESENT | `r3f/components/SceneTreeViewer/SceneTreeViewer.tsx:58-66` (`handleExpandAll` walks `rootNodes`, populates Set, calls `setExpandedNodePaths(all)`) + `controlBtn` buttons lines 95-115 | `collectAllPaths` recurses, builds full path set. Buttons remain `⊞`/`⊟`. | (WI-R3F-4) |
| 6 | Tree search | PRESENT | `r3f/components/SceneTreeViewer/SceneTreeViewer.tsx:36-41` (`nodeMatchesSearch` recurses into children, name + type match) + search `<input type="search">` lines 82-91; `TreeNode.tsx` filters children via `node.children.filter(matches)` | Filter semantics match main (recursive, case-insensitive). Empty-state copy `No nodes match "<term>"`. | (WI-R3F-4) |
| 7 | Scene Info card (Nodes count + Root name) | **MISSING** | None — no equivalent React component | `r3f-main.tsx` toolbar shows only title + ViewportSelector + error message. Static HTML for `#scene-info`/`#node-count`/`#root-node` is in `index.html:54-58` but wiped by `mountR3F`'s `container.innerHTML = ''`. | WI-UX-7 (still open) |
| 8 | Node Details panel | PRESENT | `r3f/components/NodeDetailsPanel/NodeDetailsPanel.tsx` + `PropertySection.tsx` | All registered node types render via `nodeRegistry.getRegistration(node.type).propertyFormatter` or the unsupported-node fallback. Camera3D actions also wired (see #17). | (WI-R3F-4) |
| 9 | Reset Camera button | **MISSING** | `r3f/contexts/CameraControlContext.tsx` exposes `switchToCamera`/`returnToFreeView` but NOT a "frame-the-scene-bounds" `resetCamera` | `returnToFreeView` only restores the default orbit camera *type*; it does not re-frame to the scene bounding box like main's `previewUI.resetCamera()` did. No button in the toolbar. Disabled-state semantics also lost (main disables until a scene loads). | WI-UX-7 (still open) |
| 10 | Upload TSCN (top-level file input) | **MISSING** | None | `r3f-main.tsx` has no `<input type="file" accept=".tscn">`. The toolbar only has the scene selector + error span. Orphan CSS classes `.uploadGroup`/`.uploadLabel`/`.uploadInput` exist in `r3f-main.module.css:23-43` from an earlier WIP. | WI-UX-7 (still open) |
| 11 | Fixtures-list collapsible header | N/A | (intentional replacement) | Migration uses a single `<select>` dropdown (`ViewportSelector`) instead of a collapsible list. Not a regression — design intent. | — |
| 12 | Hot-reload behavior | PRESENT | Vite handles HMR for `.tsx`/`.ts`/`.css` source; fixture file edits still require `pnpm copy-fixtures` (same as main, since `predev` script is unchanged). | Migration adds React Fast Refresh on component edits (a quiet improvement vs main). | — |
| 13 | Mobile responsive layout (CSS-only tab switcher) | **MISSING** | None in `TscnPreviewShell.module.css`; `index.html:10-25` still has the mobile-tab radio inputs + nav labels but they're inside the `#app` container that `mountR3F` empties (`r3f-main.tsx:124`) | The migration shell renders `100vw × 100vh flex column` (`r3f-main.tsx:108`) with no narrow-viewport branch. `TscnPreviewShell.module.css` has zero `@media` blocks. Mobile tab radio inputs become dead DOM that gets wiped on mount anyway. | New: WI-UX-9 |
| 14 | Error banner | PRESENT | `r3f/components/TscnPreviewShell/TscnPreviewShell.tsx:139-143` renders `<div className={styles.errorBanner} role="alert"><strong>Parse error:</strong> {error}</div>` when `parseContent` returns an error | Position differs (inside the shell, above canvas) but visibility logic equivalent. Note: only fires on parse errors; fixture-fetch errors surface via the toolbar's `loadError` span (`r3f-main.tsx:117-121`). Both paths exist. | (WI-R3F-7) |
| 15 | Hover-helper effect (orange BoxHelper in 3D) | **MISSING** | `r3f/contexts/SelectionContext.tsx` has `hoveredNodePath` state and `setHoveredNodePath` is wired in `TreeNode.tsx:99,103` — but NO 3D component reads it and adds a `BoxHelper`. Only CSS hover-background swaps occur (`SceneTreeViewer.module.css:107,122,220`). | Main's `HelperManager.hoverNode(0xff8800)` has no counterpart. The hover-vs-select disambiguation in the viewport is lost. | New: WI-UX-10 |
| 16 | Auto-expand ancestors on programmatic selection | PARTIAL | Click-to-select within the tree expands the row's own subtree via the user clicking the expand icon, but `setSelectedNodePath(path)` does NOT auto-expand ancestors. No `useEffect(() => addAllAncestors(selectedNodePath), …)` exists. | If the host (e.g. VS Code "Reveal in tree" command, viewport click-to-select, search-result navigation, deep-link state restore) ever calls `setSelectedNodePath` for a collapsed subtree, the row will not be scrolled into view. Currently no host triggers this so users don't observe it, but the API regression is real. | New: WI-UX-11 (low-pri) |
| 17 | Camera-switch widget (Camera3D nodes) | PRESENT | `r3f/components/NodeDetailsPanel/NodeDetailsPanel.tsx:117-131` renders "📷 Use This Camera" / "🔄 Return to Free View" buttons; wired through `CameraControlContext.switchToCamera(path)` / `.returnToFreeView()` | Visual treatment differs (text instead of main's blue button); functional parity. | (WI-R3F-5 era) |
| 18 | Fixture-load abort on rapid switching | PRESENT | `r3f-main.tsx:69, 79, 88, 94` — `let cancelled = false` + cleanup function pattern (idiomatic React equivalent of AbortController for `fetch().then`) | Different mechanism but same observable behavior — rapid fixture clicks don't cause mash-up. | — |
| 19 | Empty-state info paragraph | PARTIAL | `TscnPreviewShell.tsx:124, 127-129` renders `<div className={styles.emptyState}>No scene loaded — fix the parse error above to continue.</div>` OR `<div className={styles.loading}>Loading scene…</div>` in the tree pane | Main's two-line empty-state ("Select a .tscn file…" + "Use mouse to orbit camera. Scroll to zoom.") in the controls column is gone. Migration's empty-state is informational but doesn't tell the user about mouse controls. | New: WI-UX-12 (low-pri) |
| 20 | Resource provider abstraction | PRESENT | `apps/textscene-web/src/providers/WebResourceProvider.ts` (unchanged) + `apps/textscene-vscode/src/providers/VSCodeResourceProvider.ts` (unchanged) — both still resolve `res://…` paths in their respective hosts. | The migration extends this with `FileEventBus` + `ResourceLoader` (`r3f-main.tsx:46-52`) for the new R3F resource pipeline. | — |
| 21 | VS Code extension parity | PRESENT (untested) | `apps/textscene-vscode/src/TscnPreviewPanel.ts` updated to use `webviewReady` handshake (line 49-56 — caches `_pendingLoadContent` until React effect installs the message listener) | Functional in VS Code per Phase 3 strict-verification (task #49 completed on 4ac6539). Not re-verified at HEAD `923ba7d` since no relevant code changed. | (WI-R3F-5) |
| 22 | Drag-and-drop .tscn files | N/A | Neither main nor migration accepts drag-dropped `.tscn`. | Grepped both: no `dragover` / `drop` listeners. Not a regression. | — |
| 23 | Keyboard shortcuts | N/A | Neither main nor migration has any global `keydown` handlers. | Grepped both: no `addEventListener('keydown',…)`. Not a regression. | — |
| 24 | Tree-row icons (expand, type-badge, name, transform ⌖, instance 📦, visibility 👁️) | PRESENT | `TreeNode.tsx:131-188` enumerates all six icon classes with the same emoji/text content as main | `data-node-path`, `data-depth`, type-shorthand mapping (`N3D`/`Mesh`/`Cam`/`Light`/…) all preserved. | (WI-R3F-4) |
| 25 | "Not Implemented" badge for unsupported node types | PRESENT (new) | `TreeNode.tsx:155-163` renders an inline badge for `!nodeRegistry.getRegistration(node.type) && node.type !== 'Node'`. NodeDetailsPanel also has a dedicated unsupported-node section. | Main had `tree-empty` placeholder but didn't badge per-row. This is an improvement on main, not a regression. | — |

## Items requiring action before merge

### Tier 1 — true MISSING features main had

| WI | Feature | Recommended remediation | Effort |
|---|---|---|---|
| **WI-UX-7 (3)** | Categorized dropdown grouping | **Already done** — re-classify the existing task as resolved. `ViewportSelector.tsx:75-89` correctly emits `<optgroup>` blocks. Implementer-2 / impl-nodes-2 can verify by inspecting `bucketByCategory` and pull the item from WI-UX-7. | trivial (verify-only) |
| **WI-UX-7 (1)** | Upload TSCN top-level file input | Add `<input type="file" accept=".tscn" onChange={…}>` to `r3f-main.tsx` toolbar. On change, read text, set as `content` state. Existing `.uploadGroup`/`.uploadLabel`/`.uploadInput` classes in `r3f-main.module.css` are ready to use. | simple (~30 LOC) |
| **WI-UX-7 (2)** | Reset Camera button | Two-part. (a) Extend `CameraControlContext` with `resetCamera: () => void` that triggers a "fit-to-scene-bounds" event the canvas listens for. (b) In `TscnCanvas`, on the event, compute scene bounding box and call `controls.target.set(bbox.center); controls.update(); camera.position.copy(camera-from-bbox)`. (c) Add the button to `r3f-main.tsx` toolbar, disabled when `content === ''`. | moderate (CameraControlContext API change + bbox math) |
| **NEW WI-UX-7 (4)** | Scene Info card (Nodes count + Root) | Read `sceneGraph` via `useHierarchy()`, derive `flattenedNodes.length` + `sceneGraph.rootScene` name. Either (a) add to toolbar as a span next to ViewportSelector, or (b) a new sidebar section above the tree. Hide when `sceneGraph === null`. | simple (~25 LOC, pure presentation) |

### Tier 2 — newly-classified MISSING features (not in original WI-UX-7 scope)

| WI | Feature | Recommended remediation | Effort |
|---|---|---|---|
| **NEW WI-UX-9** | Mobile responsive layout | Add `@media (max-width: 767px)` block to `TscnPreviewShell.module.css`. Two options: (a) stack the canvas + sidebar vertically with a CSS `display: contents` + radio-input tab switcher inside React (port main's pattern), or (b) simpler — at narrow widths just stack canvas above sidebar with full-width each. Option (b) is enough for parity; option (a) is "match main exactly". Recommend (a) for true parity. | substantial (CSS + index.html may need partial restore + new React mobile-tab state) |
| **NEW WI-UX-10** | Hover-helper orange BoxHelper | New `HoverHighlight.tsx` component mirroring `SelectionHighlight.tsx` but reading `hoveredNodePath` from `SelectionContext` and using `0xff8800`. Mount alongside `<SelectionHighlight />` inside `<TscnCanvas>`. Ensure `SelectionHighlight` clears any hover for the same path (parity with main's `clearHelper('hover')` on highlight). | simple (~50 LOC, mirrors existing component) |

### Tier 3 — PARTIAL features (lower priority, optional polish)

| WI | Feature | Recommended remediation | Effort |
|---|---|---|---|
| **NEW WI-UX-11** | Auto-expand ancestors on programmatic selection | In `SelectionContext`'s `setSelectedNodePath`, also dispatch `setExpandedNodePaths(prev → prev ∪ getAncestorPaths(newPath))`. Single-line change inside the `useCallback`. | trivial (~5 LOC + 1 test) |
| **NEW WI-UX-12** | Empty-state info paragraph (mouse controls hint) | Inside `<TscnCanvas>` when `sceneGraph === null`, render an HTML overlay above the canvas with "Select a .tscn file to preview it in 3D" + "Use mouse to orbit camera. Scroll to zoom." Position absolute, pointer-events none. | trivial (~15 LOC, pure presentation) |

## Re-classification of WI-UX-7

Per row #4 above, item (3) of WI-UX-7 (categorized dropdown grouping) is already shipped and should not consume implementer-2's time. The remaining WI-UX-7 items are (1) Upload TSCN, (2) Reset Camera, plus the **new (4) Scene Info card** uncovered by this delta — all three are part of the original "missing entirely" main features documented in the inventory.

If implementer-2 has already started WI-UX-7, they can drop item (3) and add item (4); if they haven't started, dispatch the revised scope.

## Methodology note

This delta was produced by reading every section of `MAIN-FEATURE-INVENTORY.md` and cross-referencing against `git show origin/feat/r3f-migration:<path>` for each implementation pointer the inventory named. No dev server was started — the migration code was read statically because all the gaps that surface here are about presence/absence of components, contexts, DOM elements, and event handlers, not runtime behavior. (The original three-feature inventory ran the app because before/after screenshots were the deliverable; here the deliverable is a classification table, so source-read suffices.)

Items the original inventory missed (now added to `MAIN-FEATURE-INVENTORY.md` in this commit): Mobile responsive layout, Error banner, Hover-helper effect, Auto-expand ancestors, Camera-switch widget, Fixture-load abort, Empty-state info paragraph, Resource provider abstraction. Three of those (hover-helper, mobile, Scene-Info-card-equivalent depth) are MISSING and contributed materially to the delta.
