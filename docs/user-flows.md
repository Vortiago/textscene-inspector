# TextScene Inspector — User Flow Verification Scenarios

This document defines the user-visible scenarios that `browser-verifier` and `vscode-verifier` execute to validate the Phase 14 R3F migration. Each flow is independently runnable. Steps are written so that a verifier following them mechanically should reach the same observable result every time.

## Conventions

- **Flow ID** uses the prefix `WEB-`, `VSCODE-`, or `BOTH-` to indicate which verifier owns execution. `BOTH-` flows are executed once per environment by the corresponding verifier.
- **Fixture paths** are relative to the repo root and reference files that exist in the repo. Verifiers must not invent fixtures.
- **PRD US** refers to the User Stories list in the R3F migration PRD (GitHub issue [#44](https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer/issues/44); the original `work_items/PRD-r3f-migration.md` was removed in the roadmap-to-issues migration).
- **Screenshot points** mark frames the verifier should capture for the user-guide build. The user guide is assembled by `browser-verifier` (`docs/user-guide-web.md`) and `vscode-verifier` (`docs/user-guide-vscode.md`); this file is the source of truth for what each guide must cover.
- **Scope update (post-MVS):** the categories originally listed as out of scope all have registered renderer slices now — 2D nodes (including the Control overlay), physics bodies (transform-only groups per ADR-0005, plus the CollisionShape3D gizmo), audio-player nodes (AudioStreamPlayer3D speaker gizmo), AnimationPlayer/AnimationTree, GPUParticles3D, Path3D/PathFollow3D, Skeleton3D, and Sprite3D. What actually falls through `<GenericNodeFallback>` today is any type with no registration at all — real examples in the shipped scenes are `Timer` (`scenes/fixtures/unit-unsupported-nodes.tscn`) and `GPUParticles2D` (`scenes/examples/example-dodge-player.tscn`). The fallback renders an invisible transform-only group (ADR-0008 — no placeholder gizmo); the scene tree flags such nodes with a "Not Implemented" chip. Audio *playback* remains unimplemented; animation *playback* is supported for AnimationPlayer (transport-driven, ADR-0011/0012) and AnimatedSprite2D (autonomous frame playback).
- **Helper gizmos:** DirectionalLight, OmniLight, SpotLight, Camera3D, and the AudioStreamPlayer3D speaker gizmo.
- **`res://`** paths in the fixtures resolve relative to `scenes/`. The web app copies `scenes/` into its dev server; the VS Code extension resolves them relative to the workspace folder containing the `.tscn` file.

---

## WEB flows (browser-verifier)

The web previewer is single-panel. It exposes a scene palette (Ctrl/Cmd+K, opened from the toolbar's scene chip) backed by the auto-generated manifest in `apps/textscene-web/src/fixtures.ts`, which loads scenes by name. The verifier drives the browser via Playwright against `pnpm --filter @textscene/web-previewer dev`.

### WEB-01 — App boots to a working canvas

- **Target environment:** web
- **User intent:** A user opens the web previewer for the first time and sees a rendered default scene without configuring anything.
- **Steps:**
  1. Start the web dev server: `pnpm --filter @textscene/web-previewer dev`.
  2. Navigate the browser to the dev server URL (default `http://localhost:3000`).
  3. Wait for the canvas element to be present and have non-zero pixel dimensions.
  4. Read the page's WebGL canvas pixel data via `browser_evaluate` and confirm the canvas is not uniformly the clear color (i.e., something is rendered).
- **Expected observable outcomes:**
  - Step 2: HTTP 200, document title contains "TextScene".
  - Step 3: A `<canvas>` exists in the DOM, has width and height > 0.
  - Step 4: The canvas contains pixels that are not all identical to the background — confirming a default scene rendered.
  - No uncaught console errors during boot.
- **Features covered:** PRD US-27 (camera/lighting/orbit-controls work out-of-the-box).
- **Screenshot points:**
  - SCREENSHOT WEB-01-a: full page after initial load.

### WEB-02 — Fixture switcher loads every MVS unit fixture

- **Target environment:** web
- **User intent:** A user cycles through unit fixtures from the dropdown to verify each MVS primitive and node type renders.
- **Steps:**
  1. With the dev server running, navigate to the page.
  2. Locate the fixture-selector dropdown.
  3. For each fixture in the list below, select it and wait for the canvas to settle (no further network requests for 500 ms after selection):
     - `scenes/fixtures/unit-empty-scene.tscn`
     - `scenes/fixtures/unit-node3d-basic.tscn`
     - `scenes/fixtures/unit-mesh-instance-basic.tscn`
     - `scenes/fixtures/unit-box-mesh.tscn`
     - `scenes/fixtures/unit-sphere-mesh.tscn`
     - `scenes/fixtures/unit-plane-mesh.tscn`
     - `scenes/fixtures/unit-cylinder-mesh.tscn`
     - `scenes/fixtures/unit-capsule-mesh.tscn`
     - `scenes/fixtures/unit-camera-basic.tscn`
     - `scenes/fixtures/unit-world-environment-basic.tscn`
  4. After each selection, read the scene-tree panel and assert at least one node with the expected type is present (e.g., selecting `unit-box-mesh.tscn` produces a tree node of type `MeshInstance3D`).
- **Expected observable outcomes:**
  - Each fixture loads without an uncaught console error.
  - For each fixture, the scene-tree panel shows the expected root node.
  - `unit-empty-scene.tscn` shows an empty (or single-root) tree and a canvas with only the default background — no crash.
- **Features covered:** PRD US-1, US-2, US-11 (preview updates), and the per-type rendering acceptance from WI-R3F-3.
- **Screenshot points:**
  - SCREENSHOT WEB-02-a: `unit-box-mesh.tscn` selected.
  - SCREENSHOT WEB-02-b: `unit-sphere-mesh.tscn` selected.
  - SCREENSHOT WEB-02-c: `unit-plane-mesh.tscn` selected.
  - SCREENSHOT WEB-02-d: `unit-cylinder-mesh.tscn` selected.
  - SCREENSHOT WEB-02-e: `unit-capsule-mesh.tscn` selected.

### WEB-03 — Missing texture renders magenta placeholder with file label

- **Target environment:** web
- **User intent:** A user opens a scene that references a texture file the host cannot resolve and sees a clear visual indication of the missing file, not an invisible mesh.
- **Steps:**
  1. With the dev server running, select `scenes/fixtures/test-missing-texture.tscn` from the fixture switcher. (This fixture references `res://textures/test-upload.png`, which is intentionally absent from the repo.)
  2. Wait for the canvas to settle.
  3. Read the rendered mesh's material color: sample the pixel center of the rendered mesh via `browser_evaluate` on the canvas.
  4. Inspect the DOM/scene overlay for the missing-file label.
- **Expected observable outcomes:**
  - Step 2: The scene-tree panel shows a `MeshInstance3D` node named `TestMesh`.
  - Step 3: The mesh is visible (non-empty pixels at its screen position) and is tinted magenta — the documented placeholder color from PRD §Implementation Decisions, `useResource` example.
  - Step 4: A visible label or overlay shows `res://textures/test-upload.png` so the user knows which file is missing.
  - No uncaught console errors. A `warn`-level log entry mentioning the missing path is acceptable and expected.
- **Features covered:** PRD US-5, US-5a, US-5c, US-26.
- **Screenshot points:**
  - SCREENSHOT WEB-03-a: full canvas with magenta placeholder and visible missing-file label.

### WEB-04 — Late-arrival texture upload re-renders only the affected mesh

- **Target environment:** web
- **User intent:** A user opens a scene with a missing texture, then later provides the file via an upload control. Only the mesh that depended on the missing file re-renders; the rest of the scene is untouched.
- **Steps:**
  1. Select `scenes/fixtures/test-missing-texture.tscn`. Confirm the magenta placeholder as in WEB-03.
  2. In a separate Node3D-rooted reference scene loaded into the same viewport (or in the page's "Uploaded files" panel — implementation-defined), upload a real PNG with the name `test-upload.png`. The browser-verifier can use any small PNG; suggested asset: `scenes/fixtures/textures/normal-bumps.png` renamed to `test-upload.png` for upload.
  3. Wait for the canvas to settle (no further network requests for 500 ms).
  4. Re-sample the rendered mesh's center pixel.
  5. Inspect the scene-tree panel and confirm no nodes were added or removed.
- **Expected observable outcomes:**
  - Step 3: The previously-magenta mesh now displays the uploaded texture's content. Sampled pixel is no longer magenta and matches a non-placeholder color range.
  - Step 4: The missing-file label is no longer visible on that mesh.
  - Step 5: Tree contents are unchanged across the upload — only the texture changed, not the structure.
  - No full-scene rebuild occurs. (Detection: orbit-controls camera position from prior interaction is preserved — see WEB-07 for the explicit camera-survives test.)
- **Features covered:** PRD US-3, US-5b.
- **Screenshot points:**
  - SCREENSHOT WEB-04-a: placeholder magenta before upload (cross-reference WEB-03-a).
  - SCREENSHOT WEB-04-b: textured mesh after upload.

### WEB-05 — Shared texture late-arrival updates every dependent mesh

- **Target environment:** web
- **User intent:** A user has a scene where multiple meshes share one texture; when the shared file finally loads, every dependent mesh updates in lockstep — none lag, none are skipped.
- **Steps:**
  1. Select `scenes/fixtures/test-multiple-meshes-shared-texture.tscn`. This fixture defines `Mesh1` and `Mesh2` both referencing the same material (which references `res://textures/shared.png`), plus `Mesh3` which references a different material backed by `res://textures/different.png`. Both texture files are absent from the repo.
  2. Confirm all three meshes show magenta placeholders (cross-reference WEB-03).
  3. Upload a real PNG with the name `shared.png`.
  4. Wait for the canvas to settle.
  5. Sample the center pixel of each of the three meshes individually.
- **Expected observable outcomes:**
  - Step 4: `Mesh1` and `Mesh2` both update to display the newly-uploaded texture and are no longer magenta.
  - Step 5: `Mesh3` remains magenta (its texture, `different.png`, is still missing).
  - The two updates to `Mesh1` and `Mesh2` complete within the same animation frame (no perceptible lag between them in screen recording).
- **Features covered:** PRD US-5b, US-25.
- **Screenshot points:**
  - SCREENSHOT WEB-05-a: all three meshes magenta before upload.
  - SCREENSHOT WEB-05-b: `Mesh1`/`Mesh2` textured, `Mesh3` still magenta after upload.

### WEB-06 — Click a mesh in the viewport selects it in the tree

- **Target environment:** web
- **User intent:** A user clicks a mesh in the 3D viewport and the corresponding node is highlighted in the scene-tree panel and its properties shown in the details panel.
- **Steps:**
  1. Select `scenes/examples/integration-three-cubes.tscn`.
  2. Wait for the canvas to settle.
  3. Click on the canvas at the screen position of the rightmost cube.
  4. Read the scene-tree panel's selected entry.
  5. Read the node-details panel.
  6. Click an unselected tree entry (e.g., the leftmost cube's tree row).
  7. Re-read the details panel.
- **Expected observable outcomes:**
  - Step 4: The tree entry corresponding to the rightmost cube is highlighted as selected.
  - Step 5: The details panel shows the rightmost cube's transform, mesh, and material properties.
  - Step 7: The details panel now shows the leftmost cube's properties, and the tree highlight has moved.
  - The viewport's selected-mesh highlight (outline, glow, or equivalent) also moves to match.
- **Features covered:** PRD US-6.
- **Screenshot points:**
  - SCREENSHOT WEB-06-a: rightmost cube selected via viewport click.
  - SCREENSHOT WEB-06-b: leftmost cube selected via tree click.

### WEB-07 — Camera orbit survives a content-only hot reload

- **Target environment:** web
- **User intent:** A user has orbited their camera around a scene; saving an edit to the file's content (not switching to a different file) must not reset their viewpoint.
- **Steps:**
  1. Select `scenes/fixtures/unit-box-mesh.tscn`.
  2. Use orbit-controls to rotate the camera to a non-default angle (drag the canvas to rotate by approximately 45° azimuth, 20° elevation).
  3. Record the current camera position and target via `browser_evaluate` reading the controls state.
  4. Modify the fixture file's content (e.g., change a transform value) and save. The Vite HMR pipeline propagates the change to the open page.
  5. Wait for the canvas to settle.
  6. Re-record the camera position and target.
- **Expected observable outcomes:**
  - Step 5: The mesh's transform reflects the edit.
  - Step 6: Camera position and target are equal to the values recorded in step 3 within 0.001 units of tolerance (component identity preserved across content-only re-render).
- **Features covered:** PRD US-8.
- **Screenshot points:**
  - SCREENSHOT WEB-07-a: orbited camera before edit.
  - SCREENSHOT WEB-07-b: same camera angle after edit, with mesh transform changed.

### WEB-08 — Generic-node fallback keeps unsupported types discoverable

- **Target environment:** web
- **User intent:** A user opens a scene that contains a node type with no registered renderer (e.g., `Timer`). The node stays discoverable in the scene tree rather than vanishing silently.
- **Steps:**
  1. Select `scenes/fixtures/unit-unsupported-nodes.tscn`.
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel.
  4. Confirm the registered types render per their registrations and the unregistered type is flagged in the tree.
- **Expected observable outcomes:**
  - Step 3: The tree contains `PhysicsArea`, `AnimPlayer`, `GameTimer`, `Title`, and `Description` — exactly as parsed.
  - Step 4: `Area3D` (PhysicsArea) and `AnimationPlayer` (AnimPlayer) are registered types now — Area3D renders as a transform-only group (ADR-0005/ADR-0008) and AnimationPlayer's node renders (playback not implemented); neither is flagged. `Timer` (GameTimer) has no registration: it renders through `<GenericNodeFallback>` as an invisible transform-only group (ADR-0008 — no placeholder gizmo in the viewport) and the tree tags it with a "Not Implemented" chip.
  - `Label3D` nodes (`Title`, `Description`) render as billboarded 3D text via their registered component.
  - No uncaught console errors.
- **Features covered:** PRD US-11.
- **Screenshot points:**
  - SCREENSHOT WEB-08-a: scene tree showing the "Not Implemented" chip on the unregistered node.

### WEB-09 — Helper gizmos visible for lights and cameras

- **Target environment:** web
- **User intent:** A user wants to see where lights and cameras are placed in the scene, since those nodes do not produce geometry of their own.
- **Steps:**
  1. Select `scenes/examples/integration-lights-all-types.tscn`.
  2. Wait for the canvas to settle.
  3. Look for visible gizmo primitives at the transforms of `DirectionalLight3D`, `OmniLight3D`, and `SpotLight3D`.
  4. Switch to `scenes/fixtures/unit-camera-basic.tscn`.
  5. Look for a visible camera gizmo at the camera's transform.
- **Expected observable outcomes:**
  - Step 3: Three distinct gizmo helpers are visible at the three light positions. The shapes match light type (arrow for directional, sphere/billboard for omni, cone or frustum for spot).
  - Step 5: A camera-frustum or equivalent gizmo is visible at the camera position.
- **Features covered:** PRD US-7.
- **Screenshot points:**
  - SCREENSHOT WEB-09-a: three light gizmos visible.
  - SCREENSHOT WEB-09-b: camera gizmo visible.

### WEB-10 — Malformed fixture surfaces an error without crashing

- **Target environment:** web
- **User intent:** A user has saved a malformed `.tscn` file by mistake. The previewer surfaces the error visibly and keeps the rest of the app responsive — it does not white-screen.
- **Steps:**
  1. Select `scenes/fixtures/edge-malformed-bracket.tscn` (deliberately missing closing brackets).
  2. Wait for the canvas to settle.
  3. Inspect the page for an error message or banner.
  4. Switch back to `scenes/fixtures/unit-box-mesh.tscn`.
- **Expected observable outcomes:**
  - Step 3: A user-visible error indicator describes the parse failure (or at minimum reports that the scene could not be rendered). The app does not crash; the canvas and panels remain interactive.
  - Step 4: The well-formed fixture loads normally — no leftover error state.
- **Features covered:** PRD US-5 (errors surface clearly), defensive behavior of the lenient parser.
- **Screenshot points:**
  - SCREENSHOT WEB-10-a: error indicator visible after loading malformed fixture.

---

## VSCODE flows (vscode-verifier)

The VS Code extension opens a webview Preview panel for `.tscn` files via the **`textscene.openPreviewToSide`** command (command palette entry "TextScene: Open Preview to the Side" plus an editor-title button — there is no `customEditors` contribution) and exposes language features (definition provider, document-symbol provider). The verifier drives the Extension Development Host via the launch skill (the same launch skill referenced in the VS Code repo agents directory). All fixture paths assume the verifier opened this repo's root as the workspace folder.

### VSCODE-01 — Preview opens for a .tscn file via the preview command

- **Target environment:** vscode
- **User intent:** A user opens a `.tscn` file in VS Code and opens the rendered preview beside it.
- **Steps:**
  1. Launch the Extension Development Host with this repo as the workspace.
  2. Open `scenes/fixtures/unit-box-mesh.tscn` in a text editor (so it is the active editor), then run `vscode.commands.executeCommand('textscene.openPreviewToSide')` — the same command the editor-title button and the command palette entry "TextScene: Open Preview to the Side" invoke. A webview panel titled `Preview: unit-box-mesh.tscn` opens in the side editor group.
  3. Wait for the webview to load (poll for the webview's canvas to have non-zero dimensions).
- **Expected observable outcomes:**
  - Step 3: A webview panel is open showing the rendered box. The scene-tree panel inside the webview lists the `Node3D` root and a `MeshInstance3D` child.
  - No uncaught extension-host errors in the Extension Development Host output channel.
- **Features covered:** PRD US-1, US-27.
- **Screenshot points:**
  - SCREENSHOT VSCODE-01-a: VS Code window with preview panel open beside the source.

### VSCODE-02 — Hot reload propagates a property edit on save

- **Target environment:** vscode
- **User intent:** A user edits a property in the open `.tscn` file, saves, and sees the change within a frame or two.
- **Steps:**
  1. With `scenes/fixtures/unit-box-mesh.tscn` open in the preview, open the same file in a text editor in the workspace.
  2. Modify the transform (e.g., change the box's translation X from 0 to 3 on a `transform = Transform3D(...)` line).
  3. Save the file (`vscode.workspace.saveAll()`).
  4. Wait up to two seconds for the webview to reflect the change.
  5. Read the webview's canvas pixel data or scene-tree details panel for the updated transform.
- **Expected observable outcomes:**
  - Step 5: The visible box has moved on screen to match the new translation. The details panel shows the new translation value.
  - Step 4: Update latency is under ~500 ms in normal conditions.
- **Features covered:** PRD US-1, US-2.
- **Screenshot points:**
  - SCREENSHOT VSCODE-02-a: preview before edit (box at origin).
  - SCREENSHOT VSCODE-02-b: preview after save (box translated).

### VSCODE-03 — Two preview panels update independently

- **Target environment:** vscode
- **User intent:** A user opens two different scenes side-by-side. Editing one does not affect the other, and each panel has its own selection state.
- **Steps:**
  1. Open `scenes/fixtures/unit-box-mesh.tscn` and run `textscene.openPreviewToSide` to open its preview, in editor group 1.
  2. Open `scenes/fixtures/unit-sphere-mesh.tscn` and run `textscene.openPreviewToSide` again so its preview lands in editor group 2 (the command opens beside the active editor).
  3. Confirm both webviews are mounted.
  4. In webview 1, click a node in the tree (the `MeshInstance3D` child).
  5. In webview 2, click a different node (the `MeshInstance3D` child).
  6. Edit `unit-box-mesh.tscn` (change a property), save.
  7. Wait for webview 1 to update.
- **Expected observable outcomes:**
  - Step 3: Two webviews render simultaneously, each showing the correct scene.
  - After step 5: Each webview's selection state matches its own click. Selecting in one does not change the other's selection.
  - Step 7: Webview 1 reflects the new property. Webview 2's `unit-sphere-mesh.tscn` rendering is unchanged.
  - No cross-talk between panels (no spurious re-renders in panel 2 when panel 1 is edited).
- **Features covered:** PRD US-4.
- **Screenshot points:**
  - SCREENSHOT VSCODE-03-a: two preview panels open side-by-side with distinct scenes.
  - SCREENSHOT VSCODE-03-b: independent selection state in each panel.

### VSCODE-04 — Ctrl/Cmd-click on a `res://` path navigates to the file

- **Target environment:** vscode
- **User intent:** A user is reading a `.tscn` file and wants to jump to the file referenced by a `res://` path.
- **Steps:**
  1. Open `scenes/fixtures/unit-external-material.tscn` in the text editor.
  2. Locate an `ext_resource ... path="res://..."` line.
  3. Ctrl-click (or Cmd-click on macOS) the `res://` path token. The verifier may invoke the definition provider directly via `vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, position)`.
- **Expected observable outcomes:**
  - The editor opens the referenced file (`scenes/fixtures/materials/...` or similar — depends on the fixture's specific reference).
  - The active editor's URI now matches the referenced file.
  - No "no definition found" message appears.
- **Features covered:** PRD US-9. Note: this exercises `TscnDefinitionProvider`, which is salvaged verbatim and unaffected by R3F.
- **Screenshot points:**
  - SCREENSHOT VSCODE-04-a: Ctrl-click target highlighted before click.
  - SCREENSHOT VSCODE-04-b: referenced file opened after click.

### VSCODE-05 — Outline panel lists scene tree nodes

- **Target environment:** vscode
- **User intent:** A user uses the Outline panel to navigate a large scene without scrolling through the text.
- **Steps:**
  1. Open `scenes/examples/example-hierarchy-deep.tscn` in the text editor.
  2. Open the Outline view (`workbench.view.outline`).
  3. Read the outline tree's content.
  4. Click a node entry in the outline.
- **Expected observable outcomes:**
  - Step 3: The outline shows the scene hierarchy from the file — root node and children in correct nesting order, names matching the `[node name="..."]` declarations.
  - Step 4: The editor scrolls to and selects the corresponding `[node ...]` line in the text.
- **Features covered:** PRD US-10. Note: this exercises `TscnDocumentSymbolProvider`, salvaged verbatim.
- **Screenshot points:**
  - SCREENSHOT VSCODE-05-a: outline panel showing a nested hierarchy.

### VSCODE-06 — Click a mesh in the webview viewport selects it in the tree

- **Target environment:** vscode
- **User intent:** Same as WEB-06 but inside the VS Code webview, confirming click-to-select works under the webview's restricted environment.
- **Steps:**
  1. Open `scenes/examples/integration-three-cubes.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Wait for the webview canvas to settle.
  3. Click on the webview canvas at the screen position of the middle cube.
  4. Read the webview's scene-tree panel for the selected entry.
  5. Click a different tree row (the leftmost cube's row).
  6. Re-read the details panel.
- **Expected observable outcomes:**
  - Step 4: The middle cube's tree entry is selected; details panel shows its properties.
  - Step 6: Details panel switches to the leftmost cube's properties.
- **Features covered:** PRD US-6.
- **Screenshot points:**
  - SCREENSHOT VSCODE-06-a: middle cube selected in the webview.

### VSCODE-07 — Missing-file scene renders placeholder in the extension

- **Target environment:** vscode
- **User intent:** Same scenario as WEB-03 but executed inside the VS Code webview. Path resolution uses the webview's `asWebviewUri` plus the workspace-relative `res://` resolution.
- **Steps:**
  1. Open `scenes/fixtures/test-missing-texture.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Wait for the webview canvas to settle.
  3. Read the canvas pixel data at the rendered mesh's screen position.
  4. Inspect the webview DOM for the missing-file label.
- **Expected observable outcomes:**
  - Step 3: Mesh is visible, magenta placeholder color.
  - Step 4: Label or overlay names `res://textures/test-upload.png`.
  - No webview console errors that crash the panel. (A `warn` log is acceptable.)
- **Features covered:** PRD US-5, US-5a, US-5c, US-26.
- **Screenshot points:**
  - SCREENSHOT VSCODE-07-a: webview showing magenta placeholder.

### VSCODE-08 — Camera survives save inside the webview

- **Target environment:** vscode
- **User intent:** Same as WEB-07 but inside the webview, confirming the camera state survives a save in the file-watcher-driven hot reload path.
- **Steps:**
  1. Open `scenes/fixtures/unit-box-mesh.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Orbit the webview camera to a non-default angle.
  3. Record the camera state via `webview.postMessage(...)` or by exposing it on `globalThis` for the verifier to read.
  4. Edit the file's content in the text editor (e.g., change the box translation).
  5. Save.
  6. Wait for the webview to update.
  7. Re-record the camera state.
- **Expected observable outcomes:**
  - Step 6: The box's rendered position has changed.
  - Step 7: Camera position and target match step 3 within 0.001 tolerance.
- **Features covered:** PRD US-8.
- **Screenshot points:**
  - SCREENSHOT VSCODE-08-a: orbited camera before edit.
  - SCREENSHOT VSCODE-08-b: same camera angle after edit, mesh transform changed.

---

## BOTH flows (executed in both environments)

Each `BOTH-` flow is run twice — once by `browser-verifier` against the web app, once by `vscode-verifier` against the Extension Development Host. The expected outcomes are identical; only the harness differs.

### BOTH-01 — Integration scene renders all MVS primitives, lights, and surface materials

- **Target environment:** both
- **User intent:** A user opens the canonical integration fixture and sees every MVS primitive, light, and material variation rendered correctly together — the WI-R3F-5 acceptance criterion (1).
- **Steps:**
  1. Open `scenes/examples/integration-all-primitives.tscn` (web: scene palette; vscode: `textscene.openPreviewToSide` preview).
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel.
  4. Inspect the canvas for visible primitives.
- **Expected observable outcomes:**
  - Step 3: Tree contains `Root`, `Floor` (PlaneMesh), `Capsule`, `Torus`, `Prism`, `BackWall`, `DirectionalLight`, `FillLight` — matching the fixture's `[node ...]` entries.
  - Step 4: All five non-floor primitives are visible at their respective transforms. The floor and back wall are also visible. (Torus and Prism render as real primitives now — TorusMesh/PrismMesh have registered components.)
  - Lighting is non-flat — shadow side of capsule is darker than lit side (directional light is doing work).
- **Features covered:** PRD US-1, US-2, US-7 (gizmos for lights), US-11 (fallback for non-MVS Torus/Prism), WI-R3F-5 acceptance (1).
- **Screenshot points:**
  - SCREENSHOT BOTH-01-a: integration-all-primitives in this environment.

### BOTH-02 — Every MVS mesh primitive renders identifiably

- **Target environment:** both
- **User intent:** A user confirms every supported mesh primitive (Box, Sphere, Plane, Cylinder, Capsule) renders with the right shape.
- **Steps:**
  1. For each fixture in this list, open it and read back the resulting scene:
     - `scenes/fixtures/unit-box-mesh.tscn`
     - `scenes/fixtures/unit-sphere-mesh.tscn`
     - `scenes/fixtures/unit-plane-mesh.tscn`
     - `scenes/fixtures/unit-cylinder-mesh.tscn`
     - `scenes/fixtures/unit-capsule-mesh.tscn`
  2. Capture the rendered primitive in each case.
- **Expected observable outcomes:**
  - Each fixture renders a single mesh of the correct primitive type, no errors.
  - Visual shape is distinguishable (sphere is round, plane is flat, etc.).
  - Cross-reference WEB-02 / VSCODE-01.
- **Features covered:** WI-R3F-3 acceptance — per-type fixture rendering.
- **Screenshot points:**
  - SCREENSHOT BOTH-02-a through -e: one screenshot per primitive.

### BOTH-03 — All three MVS light types render with visible gizmos and illumination

- **Target environment:** both
- **User intent:** A user opens a scene that contains DirectionalLight3D, OmniLight3D, and SpotLight3D and confirms all three are visualized (gizmo) and all three contribute illumination to nearby meshes.
- **Steps:**
  1. Open `scenes/examples/integration-lights-all-types.tscn`.
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel: confirm `DirectionalLight3D`, `OmniLight3D`, `SpotLight3D` are present.
  4. Visually inspect for gizmo helpers at each light's transform.
  5. Add a simple mesh receiver: the fixture lacks meshes by design — instead, the verifier should also load `scenes/examples/integration-mixed-nodes.tscn` (which contains both lights and meshes) and confirm shading variation across the meshes.
- **Expected observable outcomes:**
  - Step 4: Three gizmo helpers visible, shapes match light type (arrow / point / cone).
  - Step 5 (mixed-nodes fixture): meshes show shading variation consistent with multiple light sources — colored highlights from the spot light's tint, etc.
- **Features covered:** PRD US-7, WI-R3F-5 acceptance (6).
- **Screenshot points:**
  - SCREENSHOT BOTH-03-a: all-lights fixture with three gizmos visible.
  - SCREENSHOT BOTH-03-b: mixed-nodes fixture showing illumination on meshes.

### BOTH-04 — WorldEnvironment changes scene atmosphere

- **Target environment:** both
- **User intent:** A user opens a scene with a `WorldEnvironment` node and sees its effects (background color, ambient light, fog if present) on the rendered scene.
- **Steps:**
  1. Open `scenes/fixtures/unit-world-environment-basic.tscn`.
  2. Wait for the canvas to settle.
  3. Sample the canvas's far-corner pixel color (somewhere with no mesh).
  4. Open `scenes/fixtures/unit-world-environment-no-fog.tscn`.
  5. Sample the canvas's far-corner pixel color again.
- **Expected observable outcomes:**
  - Step 3: Background color matches the `WorldEnvironment`'s declared background or ambient color (not the default gray).
  - Step 5: Background color differs from step 3 — confirming the WorldEnvironment node actually drives the visible state, not a hard-coded default.
- **Features covered:** PRD US-1, WI-R3F-3 acceptance for WorldEnvironment.
- **Screenshot points:**
  - SCREENSHOT BOTH-04-a: basic WorldEnvironment fixture.
  - SCREENSHOT BOTH-04-b: no-fog WorldEnvironment fixture for comparison.

---

## Coverage matrix

| PRD US | Covered by                              |
| ------ | --------------------------------------- |
| 1      | WEB-01, WEB-02, VSCODE-01, VSCODE-02, BOTH-01, BOTH-04 |
| 2      | WEB-02, VSCODE-02, BOTH-01              |
| 3      | WEB-04                                  |
| 4      | VSCODE-03                               |
| 5      | WEB-03, WEB-10, VSCODE-07               |
| 5a     | WEB-03, VSCODE-07                       |
| 5b     | WEB-04, WEB-05                          |
| 5c     | WEB-03, VSCODE-07                       |
| 6      | WEB-06, VSCODE-06                       |
| 7      | WEB-09, BOTH-01, BOTH-03                |
| 8      | WEB-07, VSCODE-08                       |
| 9      | VSCODE-04                               |
| 10     | VSCODE-05                               |
| 11     | WEB-08, BOTH-01                         |
| 25     | WEB-05                                  |
| 26     | WEB-03, VSCODE-07                       |
| 27     | WEB-01, VSCODE-01                       |

User stories 12 through 24 and 28 are developer-/maintainer-facing and are not exercised by user-flow verification.

## Notes for verifiers

- **Audio gizmo.** `AudioStreamPlayer3D` is now a registered component with a speaker-cone gizmo (selection-gated); `AudioStreamPlayer` and `AudioStreamPlayer2D` are registered as non-visual nodes. No flow in this document exercises an audio-player gizmo directly — see `scenes/fixtures/unit-audio-stream-player.tscn` if you need one.
- **Formerly non-MVS mesh primitives.** `TorusMesh`, `PrismMesh`, and `Label3D` all render via registered components now. Only types with no registration at all (e.g. `Timer`, `GPUParticles2D`) fall through `<GenericNodeFallback>`, which renders an invisible transform-only group (ADR-0008).
- **Fixture-content drift.** If a fixture file's content has changed since this document was written, prefer the file's actual content as ground truth. Flag the drift to `user-flow-director` so the relevant step can be updated.
- **Step ambiguity.** If two interpretations of a step lead to different observable outcomes, the verifier must record both and flag the step to `user-flow-director` for clarification.
- **Screenshot naming.** Use the `SCREENSHOT <flow-id>-<letter>` tokens as the file name stem for the captured image, e.g., `web-04-b.png`. The user-guide build script in each verifier resolves these to the matching figure slot.
