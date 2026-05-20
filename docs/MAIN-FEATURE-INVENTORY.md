# Main Feature Inventory — pre-migration baseline (80fa99e)

Captured by `feature-archaeologist` in worktree `.claude/wt/arch-main` at HEAD `80fa99e`
(commit: "docs: Add Phase 13.5 Architecture document and mark as release blocker (#42)").
Vite dev server: `localhost:3000` from `apps/textscene-web`.

This document inventories app-shell UX features that exist on `main` before the R3F migration.
Use it for UX-regression triage. **Not a recommendation document — baseline only.**

Screenshots live under `.tmp/baseline-screenshots/` (gitignored).

---

## Show / hide button on tree rows

**Trigger:** Click the eye icon (👁️) on any tree row in the Scene Tree panel. The icon flips to a strikethrough-eye (🙈) and the row text is rendered with a strike-through. Click again to restore.

**Expected behavior:** The corresponding 3D object (and all descendants) is removed from the viewport when hidden, restored when shown. Hidden ancestors propagate to all descendant rows (descendant rows show as hidden visually because an ancestor is hidden, even though their own hiddenNodes flag is not set). Visibility state is per-path and persists across re-renders of the tree.

**Implementation pointer:**
- `packages/textscene-core/src/ui/SceneTreeViewer.ts`
  - `hiddenNodes: Set<string>` (line 23) — per-path state
  - `isNodeVisible(nodePath)` (line 88) — checks self + all ancestors via `getAncestorPaths`
  - `toggleNodeVisibility(nodePath)` (line 99)
  - `createVisibilityIcon` (line 118) — emits `.tree-visibility-icon` 👁️ / 🙈 span with `title="Click to hide"` / `"Click to show"`
  - `onNodeVisibilityChange?: (nodePath, visible) => void` callback in `SceneTreeViewerOptions` (line 13)
- `packages/textscene-core/src/ui/TscnPreviewUI.ts:73-74` wires the callback to `this.renderer.setNodeVisibility(nodePath, visible)` (SceneManager).

**Verification fixture used:** `integration-three-cubes.tscn` — RightCube hidden, viewport drops from 3 cubes to 2.

**Screenshot before:** `.tmp/baseline-screenshots/01-show-hide-before.png`
**Screenshot after:** `.tmp/baseline-screenshots/01-show-hide-after.png`

Observed DOM transition: `<span class="tree-visibility-icon" title="Click to hide">👁️</span>` → `<span class="tree-visibility-icon" title="Click to show">🙈</span>`. RightCube row gets strike-through styling; viewport drops the corresponding `Object3D`.

---

## Highlight-selected in viewport

**Trigger:** Single-click a tree row. The row gains `tree-node-header selected` CSS class (blue background) and the corresponding 3D object in the viewport is wrapped in a green wireframe outline.

**Expected behavior:** Visual indication in both panels — selected row highlighted in tree, mesh wrapped with a green `THREE.BoxHelper`. Node Details panel below the tree updates to show the selected node's type/path/parent/properties. Selecting a new row replaces the highlight (only one selection at a time). For nodes that opt-in via `userData.getHighlightTarget()` with a material that has a `color`, the highlight is achieved by mutating `material.color` instead of adding a BoxHelper.

**Implementation pointer:**
- `packages/textscene-core/src/core/HelperManager.ts`
  - `helpers: Map<string, THREE.BoxHelper>` (line 15) — keyed by string ("highlight" / "hover")
  - `setHelper(key, nodePath, color)` (line 34) — picks BoxHelper or color-mutation branch via `customTarget = object.userData.getHighlightTarget?.()`
  - `highlightNode(nodePath)` (line 120) — entry point used by UI
  - `clearHelper(key)` (line 67), `clearAll()` (line 89)
- `packages/textscene-core/src/ui/TscnPreviewUI.ts:68-70` wires `onNodeSelect` → `this.renderer.highlightNode(path)` (web context). A second wiring lives at lines 102-104 for the other constructor path.
- DOM: row marker is `<div class="tree-node-header selected">…</div>` (SceneTreeViewer applies the `.selected` class via internal state).
- Tests: `packages/textscene-core/src/core/HelperManager.test.ts` (extensive — see "highlightNode" describe block starting line 46).

**Verification fixture used:** `integration-three-cubes.tscn` — selected `ThreeCubes/CenterCube/ChildCube/Cube`, observed:
- Tree row: `class="tree-node-header selected"` (blue background)
- Viewport: green wireframe box hugging the center cube
- Node Details panel populated with `Type: MeshInstance3D`, `Path: ThreeCubes/CenterCube/ChildCube/Cube`, etc.

**Screenshot (selected, highlighted):** `.tmp/baseline-screenshots/02-highlight-selected.png`

(No separate "deselected" screenshot captured — deselection is achieved by selecting another node; the highlight follows the new selection. The screenshot above shows the active state with both the tree-row .selected class and the green BoxHelper around the CenterCube mesh.)

---

## Missing-files-list / aggregate upload panel

**Trigger:** Load a scene whose `[ext_resource …]` paths cannot be resolved by the `WebResourceProvider`. A "Resource Files" panel appears in the left sidebar listing every unresolved path. Each row has its own `<input type="file">` upload control. Uploaded paths flip to a green ✓ row with a red "Remove" button; remaining missing paths stay yellow with `⚠`.

**Expected behavior:**
- Panel is hidden when no missing resources and no uploaded files (CSS class `.visible` toggled on `#resource-files`).
- Aggregate: every unique missing path appears as its own row, regardless of how many materials/meshes reference it (e.g., `test-multiple-meshes-shared-texture.tscn` references `res://textures/shared.png` from two materials but the list shows ONE row).
- Each missing row has a per-file `<input type="file">` that, on change, calls `resourceProvider.addUploadedFile(path, file)` then `previewUI.getRenderer().provideResource(path)` (asynchronous; the texture appears in the viewport once the renderer re-resolves).
- After upload the row is re-rendered with `.uploaded` class + `Remove` button (clicking it deletes the file from the provider's cache and the row flips back to missing).
- Resets to empty when a new `.tscn` file is uploaded (`missingResourcesMap.clear()` in the file-input handler).

**Implementation pointer:**
- `apps/textscene-web/src/main.ts`
  - `missingResourcesMap: Map<string, MissingResource>` (line 44) — single source of truth for outstanding paths
  - `updateResourceFilesList()` (lines 46–140) — full render of the `<div id="resource-files-list">` with uploaded-then-missing ordering
  - `addMissingResourceToUI(resource)` (lines 142–152) — de-dupe + remember
  - `onResourceNeeded` callback (line 165) — pushed into the renderer's lifecycle hook
- `apps/textscene-web/src/providers/WebResourceProvider.ts` — `getUploadedFiles()` returns the live `Map<string, File>` so the render code can iterate uploaded entries.
- `apps/textscene-web/index.html:42-44` — panel DOM: `<div class="resource-files" id="resource-files"><div id="resource-files-list"></div></div>`.

**Verification fixture used:** `test-multiple-meshes-shared-texture.tscn` — two missing paths (`res://textures/different.png`, `res://textures/shared.png`).

**Screenshot panel populated (both missing):** `.tmp/baseline-screenshots/03-missing-files-panel-populated.png`
**Screenshot after uploading one (shared.png uploaded, different.png still missing):** `.tmp/baseline-screenshots/03-missing-files-panel-after-upload.png`

DOM transition observed (one row):
```
<div class="resource-file-item missing">
  <div class="resource-file-icon missing">⚠</div>
  <div class="resource-file-path">res://textures/shared.png</div>
  <div class="resource-file-action"><input type="file" …></div>
</div>
```
→ after upload →
```
<div class="resource-file-item uploaded">
  <div class="resource-file-icon uploaded">✓</div>
  <div class="resource-file-path">res://textures/shared.png</div>
  <div class="resource-file-action"><button class="resource-file-remove">Remove</button></div>
</div>
```

---

## Other notable app-shell UX (exercised but no per-feature before/after)

### Scene switcher (fixture list)

**Trigger:** Click any item in the categorized "Test Fixtures" left sidebar list.
**Expected behavior:** Loads the corresponding `.tscn` file from `public/fixtures/`, replaces the current scene, clears missing-resources panel, re-populates tree, resets viewport. Categories shown: "Edge Cases", "Examples - Complex Scenes", "Integration - Multi-Node", "Other", "Unit - Primitive Meshes", "Unit - Basic Nodes", "Unit - External Resources", "Unit - Materials".
**Implementation pointer:** `apps/textscene-web/src/main.ts` (fixture click handlers below line 200), fixture catalog in `apps/textscene-web/src/fixtures.ts`. The header `#fixtures-header` is a collapsible toggle for the whole sidebar.

### Expand-all / collapse-all

**Trigger:** Click `⊞` (expand-all) or `⊟` (collapse-all) buttons next to the "Scene Tree" header.
**Expected behavior:** Expand toggles every tree node open; collapse closes them all. Verified with `example-hallway.tscn`: 286 `.tree-node` divs visible after expand, 1 (root) after collapse.
**Implementation pointer:** Buttons `#expand-all-btn` / `#collapse-all-btn` in `apps/textscene-web/index.html`; handlers internal to `SceneTreeViewer.ts` driven by the buttons via `TscnPreviewUI` wiring.

### Tree search

**Trigger:** Type into `#tree-search` (placeholder "Search nodes..."). The tree filters to nodes whose name matches the term (and re-expands ancestors so matches stay visible).
**Expected behavior:** Verified on `example-hallway.tscn` with term "Wall" → tree shrank to ancestor chain + 5 matching leaves: `Hallway`, `ShortCorridorFurniture`, `EntranceFurniture`, `WallMirror2`, `WallMirror`. When no matches: empty-state message "No nodes match \"<term>\"".
**Implementation pointer:** `packages/textscene-core/src/ui/SceneTreeViewer.ts` — `searchTerm: string` field, `shouldShowNode` method (line 444ish), search-input handler wired in `TscnPreviewUI.ts`.

### Scene Info card

**Trigger:** Loads automatically when a scene parses successfully. Shows in left sidebar.
**Expected behavior:** Green-tinted card with bold "Scene Info" heading and two paragraphs: `Nodes: <count>`, `Root: <rootNodeName>`. E.g., for `integration-three-cubes.tscn`: `Nodes: 11`, `Root: ThreeCubes`.
**Implementation pointer:** Updated by `TscnPreviewUI.ts` using the `nodeCount` + `rootNode` elements (`#node-count`, `#root-node` in `index.html`).

### Node Details panel

**Trigger:** Select a tree row (also drives "highlight-selected").
**Expected behavior:** Below the scene-tree, the `#node-details-panel` shows formatted properties: Type, Path, Parent, plus type-specific sections (Mesh, Material Overrides, Position/Rotation/Scale, etc.).
**Implementation pointer:** `packages/textscene-core/src/ui/NodeDetailsFormatter.ts` (HTML generation), `TscnPreviewUI.ts` calls into it on selection.

### Reset Camera button

**Trigger:** Click the blue "Reset Camera" button (disabled until a scene is loaded).
**Expected behavior:** Re-frames the OrbitControls camera on the scene origin / bounds. Becomes enabled (`disabled=false`) when a scene loads.
**Implementation pointer:** `apps/textscene-web/src/main.ts` — `resetButton.addEventListener('click', () => { previewUI.resetCamera(); })` near line 192.

### Upload .tscn (top-level file input)

**Trigger:** Click "Upload TSCN File: [Choose File]" button at the top-left, pick a `.tscn`.
**Expected behavior:** Parses content via `previewUI.loadTscn(content)`. Clears the missing-resources map first. On parse error, shows `previewUI.showError(...)` (red banner area `#error-display` with `#error-message`).
**Implementation pointer:** `apps/textscene-web/src/main.ts` lines 173-190.

### Fixtures-list collapsible header

**Trigger:** Click the "Test Fixtures ▼" header.
**Expected behavior:** Toggles visibility of the entire fixture category list (does not affect already-loaded scene).
**Implementation pointer:** `fixturesHeader` listener in `apps/textscene-web/src/main.ts` (just below line 196).

### Hot-reload behavior

Vite dev server provides standard HMR — editing a `.tscn` fixture file copied into `public/fixtures/` does NOT auto-refresh the canvas; the user must re-click the fixture in the list. Editing `.ts` source code in `apps/textscene-web/src/` or `packages/textscene-core/src/` triggers Vite HMR + WebSocket reload. (Observed: not specifically tested in this session, behavior inherited from `pnpm dev` + `predev` copy step in `package.json`.)

### Mobile responsive layout (CSS-only tab switcher)

**Trigger:** Page width ≤ 767px. The CSS-only mobile-tab nav appears at the top of the page; clicking 📺 Viewport / 🌳 Tree / ⚙️ Controls labels toggles which panel is on-screen.
**Expected behavior:**
- Hidden radio inputs `#panel-viewport`, `#panel-tree`, `#panel-controls` are at the top of `<body>` (`apps/textscene-web/index.html:11-13`); `#panel-viewport` is `checked` by default.
- `<nav class="mobile-tabs">` (lines 21-25) holds three `<label for="panel-…">` buttons.
- `apps/textscene-web/styles.css` drives the layout via `body:has(#panel-XXX:checked) <selector>` rules (lines 599-666+). Three `@media (max-width: 767px)` and `@media (min-width: 768px)` blocks toggle the nav-bar visibility and which panel pane is shown.
- On wide (≥768px) viewports `.mobile-tabs { display: none }` and all three panes render side-by-side.
**Implementation pointer:** Pure HTML + CSS, no JS. `apps/textscene-web/index.html:10-25` (radio inputs + nav), `apps/textscene-web/styles.css:599-768`.

### Error banner

**Trigger:** Parse failure when calling `previewUI.loadTscn(...)`. `showError(msg)` is called either explicitly from the fixture-load handler (`apps/textscene-web/src/main.ts:188, 253`) or from inside the renderer when scene-graph construction throws (`TscnPreviewUI.ts:222, 298`).
**Expected behavior:** Red error banner appears below the controls column. The DOM is `<div class="error" id="error-display"><strong>Error:</strong><p id="error-message">…</p></div>` (`apps/textscene-web/index.html:49-52`). The `.visible` class is toggled to show/hide; when hidden the slot collapses (no content).
**Implementation pointer:** `apps/textscene-web/index.html:49-52`; `packages/textscene-core/src/ui/TscnPreviewUI.ts:174-181` (showError + hideError); rendered styles in `apps/textscene-web/styles.css` (`.error` block).

### Hover-helper effect (orange BoxHelper in 3D)

**Trigger:** Mouse over a tree row. `SceneTreeViewer` fires its internal hover bookkeeping; main calls `HelperManager.hoverNode(path)` which adds an **orange** (`0xff8800`) `THREE.BoxHelper` around the corresponding mesh in the viewport. Mouse-leave triggers `HelperManager.clearHover()`. Highlight (selection) clears hover when activated.
**Expected behavior:** Visual disambiguation between hover and selection — hover is orange, selection is green. The hover helper disappears as soon as the cursor leaves the tree row OR a node is selected.
**Implementation pointer:**
- `packages/textscene-core/src/core/HelperManager.ts`
  - `hoverNode(nodePath)` (line ~133) — `setHelper('hover', nodePath, 0xff8800)`
  - `clearHover()` (line ~143) — `clearHelper('hover')`
  - `highlightNode` clears hover internally (line 121) so you never see both colors at once.
- Tests: `packages/textscene-core/src/core/HelperManager.test.ts` "hoverNode" describe block.

### Auto-expand ancestors on programmatic selection

**Trigger:** `SceneTreeViewer.selectNode(path)` is called (typically from a host that wants to focus a node — clicking in the viewport, search-result navigation, etc.).
**Expected behavior:** All ancestor paths of the selected node are unconditionally added to `expandedNodes`, so the row is on-screen when the tree re-renders. Without this, programmatic selections inside a collapsed subtree would not be visible.
**Implementation pointer:** `packages/textscene-core/src/ui/SceneTreeViewer.ts:280-290` (`selectNode` method calls `getAncestorPaths(nodePath).forEach(p => expandedNodes.add(p))`).

### Camera-switch widget (Camera3D nodes)

**Trigger:** Select a `Camera3D` node in the tree. The Node Details panel renders two extra buttons: "📷 Use This Camera" and "🔄 Return to Free View".
**Expected behavior:** "Use This Camera" switches the active camera in the viewport from the orbit-controls perspective camera to the selected `Camera3D`'s point of view (matching that camera's transform + fov/projection). "Return to Free View" restores the orbit perspective camera.
**Implementation pointer:** `packages/textscene-core/src/ui/NodeDetailsFormatter.ts:46-69` — hardcoded HTML for `node.type === 'Camera3D'` that emits `<button class="use-camera-btn" data-camera-path="…">` and `<button class="reset-camera-btn">`. Event delegation in `TscnPreviewUI.ts` translates clicks into calls on `SceneManager`.

### Fixture-load abort on rapid switching

**Trigger:** Click fixture A, then before A finishes loading click fixture B.
**Expected behavior:** Fixture A's fetch is aborted via `AbortController.abort()` and a benign log line is emitted; only fixture B's content lands in the scene. No half-loaded mash-up.
**Implementation pointer:** `apps/textscene-web/src/main.ts:200, 222-249` — `currentFixtureAbortController: AbortController | null` + per-click `controller.abort()` then `new AbortController()`. The `fetch(...)` is called with `{ signal: controller.signal }`. Catch block silently swallows `err.name === 'AbortError'`.

### Empty-state info paragraph

**Trigger:** First page load (no scene selected).
**Expected behavior:** Below the Reset Camera button, two paragraphs read "Select a .tscn file to preview it in 3D." and "Use mouse to orbit camera. Scroll to zoom." (the second is muted in `#888`).
**Implementation pointer:** Static HTML at `apps/textscene-web/index.html:60-65` inside `<div class="info">`.

### Resource provider abstraction (host-pluggable resource resolution)

**Trigger:** Implicit — any code path that needs an external resource (textures, materials, packed scenes).
**Expected behavior:** Both `apps/textscene-web` and `apps/textscene-vscode` implement their own `ResourceProvider` (`WebResourceProvider`, `VSCodeResourceProvider`) so the same renderer code can resolve `res://…` paths in the browser via uploaded files OR in VS Code via workspace fs. Drives the missing-files panel's lifecycle hook.
**Implementation pointer:** `apps/textscene-web/src/providers/WebResourceProvider.ts`; equivalent in VS Code extension. `TscnPreviewUI` options accept `resourceProvider`.

---

## Environment notes for future verifiers

- Vite Local URL printed: `http://localhost:3000/`. Network URL not exposed.
- The `predev` script runs `pnpm copy-fixtures` then `pnpm --filter @textscene/core build`. This means **scene file additions require restarting the dev server** (or running `pnpm copy-fixtures` manually) to propagate to `public/fixtures/`.
- Default scene on first load: no scene selected (sidebar shows placeholder text "Select a .tscn file to preview it in 3D"). Reset Camera button is disabled until first scene load.
- All tree DOM hooks use BEM-ish flat class names (`tree-node`, `tree-node-header`, `tree-node-header.selected`, `tree-visibility-icon`, `tree-transform-icon`, `tree-instance-icon`, `tree-expand-icon`, `tree-node-children`). Per-node identifier is `data-node-path="<full-path-with-slashes>"`.
- All fixture-list DOM uses `data-fixture="<filename>.tscn"` attribute for programmatic loading.
