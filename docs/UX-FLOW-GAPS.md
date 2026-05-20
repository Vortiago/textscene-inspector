# UX Flow Gaps — `feat/r3f-migration` web previewer

Field run on commit `c771507` ("feat(WI-R3F-16): AudioStreamPlayer3D gizmo + AnimationPlayer details").
App rendered against the R3F entry point at `apps/textscene-web/src/r3f-main.tsx`. Code citations are absolute file paths with line numbers. Screenshots under `.tmp/ux-flow/` (gitignored — not staged).

Severity legend:
- **blocker** — promised feature is non-functional, or user is stuck mid-flow with no recovery
- **major** — feature works but UX is significantly worse than the pre-migration main branch, or affordance is missing for a common action
- **polish** — minor friction; user can still complete the flow

13 gaps documented: 4 blocker, 5 major, 4 polish.

---

## Gap 1: Visibility-toggle in tree does not hide nodes in the 3D viewport

**Severity**: blocker
**Flow**: B
**Gap**: Clicking the eye icon (👁️/🙈) on any tree row updates the row's strikethrough style but the corresponding node remains visible in the viewport. The "hide" affordance is therefore a lie.
**Observed in app**: Loaded `integration-all-primitives.tscn`, expanded tree, clicked Capsule's eye-icon. The Capsule row gained the `_hidden_` CSS class and the icon flipped to 🙈, but the blue capsule mesh is still rendered next to the torus.
Screenshot: `.tmp/ux-flow/B-capsule-toggled.png`
**Reference (main behavior)**: In main, visibility toggles applied to the THREE node graph directly via the imperative SceneTreeViewer; nodes actually disappeared when toggled.
**Proposed fix**:
`packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.tsx:41-77` — `hiddenNodePaths` is `useState` local to SceneTreeViewer. It is never lifted to a context, so `NodeDispatcher` (`packages/textscene-core/src/r3f/NodeDispatcher.tsx:48-129`) cannot read it. Fix: move `hiddenNodePaths` (+ `setHiddenNodePaths`) into `SelectionContext` (`packages/textscene-core/src/r3f/contexts/SelectionContext.tsx:17-25`); then in `DispatchedNode` read the path through `useSelection().hiddenNodePaths.has(path)` and wrap the `<Component>` render in a `<group visible={!isHidden}>`. The wrapping `<group onPointer...>` at `NodeDispatcher.tsx:117` is the natural place for the `visible` prop.
**Effort**: moderate

---

## Gap 2: Selecting a tree row gives no viewport feedback

**Severity**: blocker
**Flow**: C
**Gap**: Clicking a tree row updates `SelectionContext.selectedNodePath` and populates the right-pane details correctly, but the corresponding object in the 3D viewport receives no visual treatment (outline, tint, bounding box, gizmo, anything). A user cannot answer "which one in the viewport am I editing?" — defeating the purpose of a tree↔viewport pairing.
**Observed in app**: Loaded `integration-all-primitives.tscn`, clicked the Torus tree row. The details panel populated with Torus properties, but the gold torus in the viewport is visually identical to its un-selected state.
Screenshot: `.tmp/ux-flow/A-torus-properly-selected.png`
**Reference (main behavior)**: Main's SceneRenderer wrapped the selected node in a `THREE.BoxHelper` outline (cyan).
**Proposed fix**:
`packages/textscene-core/src/r3f/contexts/SelectionContext.tsx` exports `selectedNodePath`. Currently zero r3f node components import it (verified by `grep -rln 'selectedNodePath\|hoveredNodePath' packages/textscene-core/src/r3f/nodes/` returning no matches).
Two-step fix:
1. Add a `<SelectionOutline>` component at `packages/textscene-core/src/r3f/components/SelectionOutline.tsx` that reads `useSelection().selectedNodePath` and `useNodePath()` (`packages/textscene-core/src/r3f/contexts/NodePathContext.tsx`) inside a child `<group>`, then renders `@react-three/drei`'s `<Outline>` post-effect or a manual `THREE.Box3Helper` of the parent group's bounding box when paths match.
2. Mount it from `NodeDispatcher.tsx` inside the per-node `<NodePathProvider>` wrapper at line 116.
**Effort**: moderate

---

## Gap 3: Aggregate "missing files" panel is gone

**Severity**: blocker
**Flow**: D
**Gap**: When a fixture references resources that haven't been uploaded yet (e.g. `unit-sprite3d.tscn` before `test_texture.png` is uploaded), individual magenta placeholder cubes render at each missing-resource site — but the user has no single place that lists what is missing, no path-targeted upload field, and no progress UI. They must read tiny in-3D labels overlapping each other and figure out from the fileName what to look for on their disk.
**Observed in app**: Switched to `unit-sprite3d.tscn`. Three magenta squares appeared with overlapping floating-text labels `res://textures/test_texture.png miss…`. No panel anywhere lists "1 missing file" or offers an upload affordance scoped to a specific path.
Screenshot: `.tmp/ux-flow/D-missing-texture.png`
**Reference (main behavior)**: `git show main:apps/textscene-web/src/main.ts` lines 44-148 — the `updateResourceFilesList()` function maintained a `missingResourcesMap`, rendered a list of all missing resources in a dedicated `resourceFilesPanel`, and gave each missing entry an inline `<input type="file">` plus a green/yellow status indicator (✓ uploaded / ⚠ missing). The `addMissingResourceToUI()` hook was wired through the renderer's lifecycle events. None of this remains in `apps/textscene-web/src/r3f-main.tsx`.
**Proposed fix**:
In `apps/textscene-web/src/r3f-main.tsx` (around line 49-50 where `uploadedFiles` is tracked), add a parallel `missingFiles: Set<string>` state. Subscribe to `loader.events` (the `FileEventBus` already routes missing-resource broadcasts) inside a `useEffect` and add to the set on every "missing" event. Render a collapsible panel — either inside the toolbar or above the canvas — listing each entry with status (missing/loaded) and a per-row file input that calls `provider.addUploadedFile(path, file)` + `loader.provideFile(path)`. The existing global file input at lines 149-160 can stay as a fallback, but the per-row upload is what users actually need.
**Effort**: substantial

---

## Gap 4: Eye-icon button is the entire right edge of the row — easy to mis-click when trying to select

**Severity**: major
**Flow**: A / B
**Gap**: The clickable area of the visibility-toggle button extends well past the icon glyph. When clicking near the right edge of a tree row to select a node, users routinely toggle visibility instead of selecting. Compounded by Gap 1, this looks like nothing happened (because visibility doesn't actually take effect), but the icon does flip to 🙈 and the strikethrough applies.
**Observed in app**: First attempt to select Torus in `integration-all-primitives.tscn`. I clicked what looked like the row, but `aria-selected` stayed `false` on every row, and Torus's icon flipped to 🙈. The right-pane details panel never populated.
Screenshot: `.tmp/ux-flow/A-torus-selected.png` (incorrectly-toggled Torus row shows strikethrough)
**Reference (main behavior)**: Main used a much smaller eye-icon hit area pinned to the rightmost ~16px.
**Proposed fix**:
`packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.module.css` — locate `.visibilityIcon` and add explicit `width: 20px; height: 20px; padding: 0;` plus `flex-shrink: 0;` to prevent it from filling the row's flex slack. Also at `packages/textscene-core/src/r3f/components/SceneTreeViewer/TreeNode.tsx:178-186`, the `<button className={styles.visibilityIcon}>` is sandwiched in `.glyphs` which uses flex — confirm the parent `display: inline-flex` with `flex: 0 0 auto` on the button.
**Effort**: trivial

---

## Gap 5: Scene-selector dropdown is one flat list of 71 options with no grouping

**Severity**: major
**Flow**: G / F
**Gap**: The `<select>` element renders all 71 fixtures as a single ungrouped list. Categories are encoded in fixture metadata (`Unit - Basic Nodes`, `Examples - Complex Scenes`, etc.) but never expressed in the DOM. The user must skim alphabetically (or memorize fixture filenames) to find a category-relevant scene.
**Observed in app**: Opening the Scene dropdown shows `Invalid Cast Shadow` followed by `Invalid Transform`, then `Malformed Bracket`, then `Photo Wall` — all displayed in a single uncategorized scroll list. Edge cases, examples, unit fixtures, integration scenes are intermixed.
Snapshot: see the `combobox "Scene:"` listing in any `.playwright-mcp/page-*.yml`
**Reference (main behavior)**: Main's dropdown grouped fixtures under collapsible headers (`Edge Cases`, `Examples - Complex Scenes`, `Integration - Multi-Node`, etc. — visible in any `git show main:apps/textscene-web/src/main.ts` snapshot of the rendered DOM).
**Proposed fix**:
`packages/textscene-core/src/r3f/components/ViewportSelector/ViewportSelector.tsx` — the `category` field is already on `ViewportSelectorOption` (read it at `apps/textscene-web/src/r3f-main.tsx:65-69` where the fixtures are mapped). In `ViewportSelector`, group by `category` and render each group inside `<optgroup label={category}>`. ~10 lines.
**Effort**: trivial

---

## Gap 6: "Upload missing files:" label is permanently visible even with zero missing files

**Severity**: major
**Flow**: G
**Gap**: The toolbar always shows "Upload missing files:" and a `<input type="file" multiple>` field. When no files are missing (e.g. on the default `integration-all-primitives.tscn` fixture), the upload affordance is still front and center in the toolbar — suggesting to the user there is something they need to do. It also makes the toolbar wider than necessary.
**Observed in app**: All-primitives fixture loads with no missing resources, but the upload widget is right there next to the scene selector.
Screenshot: `.tmp/ux-flow/A-default-fixture.png`
**Reference (main behavior)**: Main's `resourceFilesPanel` had a `.visible` class that was only added when `hasMissing || hasUploaded` (lines 49-56 of `git show main:apps/textscene-web/src/main.ts`). Hidden until needed.
**Proposed fix**:
`apps/textscene-web/src/r3f-main.tsx:149-160` — wrap the `<label className={styles.uploadGroup}>` block in a conditional. The component needs visibility from `missingFiles.size > 0 || uploadedFiles.length > 0`. Pairs naturally with the fix for Gap 3 (which adds `missingFiles` tracking).
**Effort**: trivial (once Gap 3 lands)

---

## Gap 7: Parse-error state leaves "Loading scene…" stuck in the tree pane

**Severity**: major
**Flow**: E
**Gap**: Opening a malformed TSCN file (e.g. `edge-malformed-bracket.tscn`) shows the red parse-error banner correctly, but the right-pane scene-tree pane reads "Loading scene…" indefinitely. The user has no signal that the load *failed* in the tree pane — only that the canvas is black. A new user could plausibly wait several minutes assuming a network or worker hang.
**Observed in app**: Switching to `edge-malformed-bracket.tscn`. Red error banner at top "Parse error: Parser could not extract any nodes from the content. The file may be malformed." Tree pane permanently shows "Loading scene…". Canvas is a black void.
Screenshot: `.tmp/ux-flow/E-malformed-error.png`
**Reference (main behavior)**: Main bailed cleanly in this state — the tree pane showed an empty state with a hint message.
**Proposed fix**:
`packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx:117-122` — the condition `sceneGraph === null && !error` mounts the "Loading scene…" branch, which means when `error` is truthy the tree mounts `<SceneTreeViewer>` with `sceneGraph = null`. Inside `SceneTreeViewer.tsx:83-89`, `sceneGraph === null` then renders "Loading scene…" as the empty state.
Fix: in `TscnPreviewShell.tsx:117` change the condition to `if (error || sceneGraph === null)` and render a small "No scene loaded" / "Fix the parse error to view the tree" message instead of unconditionally mounting `<SceneTreeViewer>`.
Alternatively, plumb the `error` state into `SceneTreeViewer` so its empty-state can read "Parse error — see banner".
**Effort**: trivial

---

## Gap 8: Canvas does not render an empty-state when there is no scene

**Severity**: major
**Flow**: E
**Gap**: With no scene loaded (parse error, empty fixture), the 3D viewport is a flat black rectangle. No grid, no axis gizmo, no "Drop a .tscn file here" prompt. Indistinguishable from "the renderer crashed".
**Observed in app**: With `edge-malformed-bracket.tscn` loaded the entire central viewport is black. No visible UI in that region apart from the error banner above it.
Screenshot: `.tmp/ux-flow/E-malformed-error.png`
**Reference (main behavior)**: Main rendered a baseline grid even with no scene loaded.
**Proposed fix**:
`packages/textscene-core/src/r3f/TscnCanvas.tsx` — when `useHierarchy().sceneGraph === null` (or when there are zero nodes), still mount `<Canvas>` with a `<gridHelper>` and a friendly `<Text>` overlay reading "Load a scene to begin". Two-line behavior change. Alternative: render this fallback at the `TscnPreviewShell` level, above the `<TscnCanvas>` mount.
**Effort**: trivial

---

## Gap 9: No hover affordance for hover state — `hoveredNodePath` set but never read

**Severity**: polish
**Flow**: A
**Gap**: `SelectionContext` exposes `hoveredNodePath` (`packages/textscene-core/src/r3f/contexts/SelectionContext.tsx:18-23`), and `TreeNode.tsx:102-108` populates it on mouseenter / mouseleave. But the value is never read anywhere — no row gets a hover ring in the viewport, no row gets a subtle background tint based on hover, etc. Dead state.
**Observed in app**: Hovering over the Torus tree row in `integration-all-primitives.tscn` triggers the context update (verifiable via `useSelection()` in React DevTools) but the gold torus in the viewport is visually unchanged.
**Reference (main behavior)**: Main had no hover→viewport feedback either, so this is parity-neutral. It's flagged because the context plumbing already exists and a partial pairing with Gap 2's selection outline would be a one-line addition (hover = thinner cyan outline, selection = thicker green outline).
**Proposed fix**:
After Gap 2's `<SelectionOutline>` lands, extend it to read both `selectedNodePath` and `hoveredNodePath` and emit two different-weight outlines.
Alternative: delete the `hoveredNodePath` context slot and the `setHoveredNodePath` calls in `TreeNode.tsx:102-108` as dead code (deletion-test).
**Effort**: trivial (either direction)

---

## Gap 10: Right-clicking a tree row does nothing — no context menu

**Severity**: polish
**Flow**: A
**Gap**: Right-clicking a tree row produces the browser's native context menu (Inspect, Save As, etc.) — there is no app-level context menu offering useful actions like "Copy node path", "Reveal in source", "Frame in viewport", "Hide subtree".
**Observed in app**: Right-click on any treeitem opens the Chromium context menu.
**Reference (main behavior)**: Main also did not implement a context menu, so this is parity-neutral. Flagged as the most obvious missing affordance for power users on a tree viewer.
**Proposed fix**:
Out of scope for current parity work. If pursued: `TreeNode.tsx:54-128` — add `onContextMenu={handleContextMenu}` to the row container; render a small floating menu at the click coordinates with the four actions listed above. Or wire to the existing `onNodeReveal` callback (used by the VS Code host to jump-to-source) as a first-pass deliverable.
**Effort**: substantial

---

## Gap 11: Label3D text floods the viewport at default camera distance

**Severity**: major
**Flow**: D / H
**Gap**: Some fixtures (e.g. `unit-sprite3d.tscn`) place Label3D nodes whose text size relative to the default camera distance results in single letters filling half the screen. There is no clamp on render-size, no min-fontsize-vs-distance heuristic, no "billboard scales with distance" mode. The result is unreadable letterforms and overlapping labels in any scene with several Label3D nodes.
**Observed in app**: `unit-sprite3d.tscn` shows letters of the phrase "default, billboard, tinted+t..." each ~150 CSS pixels tall in the viewport. The actual sprites are tiny by comparison and partially obscured.
Screenshot: `.tmp/ux-flow/D-missing-texture.png`
**Reference (main behavior)**: Main rendered Label3D smaller — likely because the text-mesh used a different font_size default. Worth comparing `git show main:packages/textscene-core/src/nodes/label3d/renderer.ts` against the new R3F Label3D component at `packages/textscene-core/src/r3f/nodes/label3d/` for the default font_size and pixel_size conversion.
**Proposed fix**:
`packages/textscene-core/src/r3f/nodes/label3d/Label3D.tsx` (or whatever the R3F component is called there — verify path) — review the font_size → THREE units multiplier. Godot's Label3D `pixel_size` defaults to 0.005 and font_size defaults to 32, giving ~0.16 unit-height per line. Confirm the new component matches.
**Effort**: moderate (needs Godot-semantics check)

---

## Gap 12: Floating "missing scene" labels in 3D space overlap each other

**Severity**: polish
**Flow**: D
**Gap**: When multiple Sprite3D nodes share a missing texture (or several different missing-resource sites cluster), the in-3D placeholder labels drawn near each magenta cube collide into an illegible blob.
**Observed in app**: `unit-sprite3d.tscn` shows three magenta placeholders, and three "res://textures/test_texture.png miss..." labels overlap diagonally.
Screenshot: `.tmp/ux-flow/D-missing-texture.png`
**Reference (main behavior)**: Main's missing-texture flow surfaced this info in the DOM panel (Gap 3) instead of in 3D space, sidestepping the collision entirely.
**Proposed fix**:
Once Gap 3 lands (DOM-side missing-files panel), the in-3D labels become redundant. Remove them from `packages/textscene-core/src/r3f/NodeDispatcher.tsx:213-223` (`InstancePlaceholder`) and from whichever component renders the magenta-cube placeholder for missing textures. Keep the magenta cube as a positional anchor; drop the floating text.
**Effort**: trivial (once Gap 3 lands)

---

## Gap 13: Toolbar wraps awkwardly at narrow widths

**Severity**: polish
**Flow**: G
**Gap**: At ≤1024px the toolbar's `flex-wrap: wrap` (`apps/textscene-web/src/r3f-main.module.css:5-15`) wraps the upload group below the scene selector, but the "TextScene Inspector" title remains on the first row alone, looking orphaned. The "Upload missing files:" label and `<input>` overflow the second line of the wrapped toolbar.
**Observed in app**: Not reproduced at 1440x900 viewport — would need to test at narrower sizes. Flagged as a likely issue from the CSS structure alone.
**Reference (main behavior)**: Main had separate panels stacked vertically by default, so this wasn't a concern.
**Proposed fix**:
`apps/textscene-web/src/r3f-main.module.css:5-15` — add a `min-width` to the title and an explicit `flex: 1 1 auto` distribution. Or restructure so the title is `position: absolute; left: var(--tsi-space-3)` and the controls flex inside a right-aligned group.
**Effort**: trivial
