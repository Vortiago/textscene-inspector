# TextScene Inspector: User Flow Verification Scenarios

This document defines the user-visible scenarios that a verifier runs against the web previewer and the VS Code extension. Each flow runs on its own. A verifier who follows the steps exactly should reach the same observable result every time.

## Conventions

- **Flow ID** uses the prefix `WEB-`, `VSCODE-` or `BOTH-` to show which environment it runs in. A verifier runs each `BOTH-` flow once in each environment.
- **Fixture paths** are relative to the repo root and reference files that exist in the repo. Verifiers must not invent fixtures.
- **PRD US** refers to the User Stories list in the R3F migration PRD (GitHub issue [#44](https://github.com/Vortiago/textscene-inspector/issues/44)).
- **Screenshot points** mark the frames the verifier captures for the user guides, `docs/user-guide-web.md` and `docs/user-guide-vscode.md`. This file is the source of truth for what each guide must cover.
- **Scope:** 2D nodes (including Control nodes), physics bodies (transform-only groups per ADR-0005, with the CollisionShape3D gizmo), audio-player nodes (AudioStreamPlayer3D speaker gizmo), AnimationPlayer and AnimationTree, GPUParticles3D, Path3D and PathFollow3D, Skeleton3D and Sprite3D all have registered renderer slices. A type with no registration falls through `<GenericNodeFallback>`, which renders an invisible transform-only group with no placeholder gizmo (ADR-0008). A type registered as `pending`, such as `GPUParticles2D` (`scenes/fixtures/example-dodge-player.tscn`), renders through its base type. The scene tree flags both with a "Not Implemented" chip. Audio *playback* is not implemented. Animation *playback* works for AnimationPlayer (transport-driven, ADR-0011/0012) and AnimatedSprite2D (transport-driven frame playback, ADR-0015).
- **Helper gizmos:** DirectionalLight, OmniLight, SpotLight, Camera3D, and the AudioStreamPlayer3D speaker gizmo.
- **`res://`** paths in the fixtures resolve relative to `scenes/`. The web app copies `scenes/` into its dev server. The VS Code extension resolves them relative to the workspace folder that contains the `.tscn` file.

## WEB flows

The web previewer has one panel. Its scene palette (Ctrl/Cmd+K, or the toolbar's scene chip) lists the generated manifest in `apps/textscene-web/src/fixtures.ts` and loads a scene by name. The verifier drives the browser with Playwright against `pnpm --filter @textscene/web-previewer dev`.

### WEB-01: App boots to a working canvas

- **Target environment:** web
- **User intent:** A user opens the web previewer for the first time and sees a rendered default scene without configuring anything.
- **Steps:**
  1. Start the web dev server: `pnpm --filter @textscene/web-previewer dev`.
  2. Navigate the browser to the dev server URL (default `http://localhost:3000`).
  3. Wait for the canvas element to be present and have non-zero pixel dimensions.
  4. Read the page's WebGL canvas pixel data with `browser_evaluate` and confirm that the canvas is not all the clear color, that is, something is rendered.
- **Expected observable outcomes:**
  - Step 2: HTTP 200, document title contains "TextScene".
  - Step 3: A `<canvas>` exists in the DOM, has width and height > 0.
  - Step 4: The canvas contains pixels that differ from the background, so a default scene rendered.
  - No uncaught console errors during boot.
- **Features covered:** PRD US-27 (camera/lighting/orbit-controls work out-of-the-box).
- **Screenshot points:**
  - SCREENSHOT WEB-01-a: full page after initial load.

### WEB-02: Fixture switcher loads every unit fixture

- **Target environment:** web
- **User intent:** A user cycles through the unit fixtures in the scene palette to confirm that each primitive and node type renders.
- **Steps:**
  1. With the dev server running, navigate to the page.
  2. Open the scene palette.
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
  4. After each selection, read the scene-tree panel and assert that at least one node of the expected type is present (for example, selecting `unit-box-mesh.tscn` produces a tree node of type `MeshInstance3D`).
- **Expected observable outcomes:**
  - Each fixture loads without an uncaught console error.
  - For each fixture, the scene-tree panel shows the expected root node.
  - `unit-empty-scene.tscn` shows an empty (or single-root) tree and a canvas with only the default background, with no crash.
- **Features covered:** PRD US-1, US-2, US-11 (preview updates), and per-type rendering.
- **Screenshot points:**
  - SCREENSHOT WEB-02-a: `unit-box-mesh.tscn` selected.
  - SCREENSHOT WEB-02-b: `unit-sphere-mesh.tscn` selected.
  - SCREENSHOT WEB-02-c: `unit-plane-mesh.tscn` selected.
  - SCREENSHOT WEB-02-d: `unit-cylinder-mesh.tscn` selected.
  - SCREENSHOT WEB-02-e: `unit-capsule-mesh.tscn` selected.

### WEB-03: Missing texture renders magenta placeholder and lists the file

- **Target environment:** web
- **User intent:** A user opens a scene that references a texture file the host cannot resolve and sees a clear visual indication of the missing file, not an invisible mesh.
- **Steps:**
  1. With the dev server running, select `scenes/fixtures/test-missing-texture.tscn` from the scene palette. This fixture references `res://textures/test-upload.png`, which is absent from the repo on purpose.
  2. Wait for the canvas to settle.
  3. Read the rendered mesh's material color: sample the centre pixel of the rendered mesh with `browser_evaluate` on the canvas.
  4. Open the **Resources** tab and read the missing-file rows.
- **Expected observable outcomes:**
  - Step 2: The scene-tree panel shows a `MeshInstance3D` node named `TestMesh`.
  - Step 3: The mesh is visible (non-empty pixels at its screen position) and magenta, the placeholder color from PRD §Implementation Decisions, `useResource` example.
  - Step 4: A row names `res://textures/test-upload.png`, so the user knows which file is missing.
  - No uncaught console errors. A `warn`-level log entry that names the missing path is expected.
- **Features covered:** PRD US-5, US-5a, US-5c, US-26.
- **Screenshot points:**
  - SCREENSHOT WEB-03-a: full canvas with the magenta placeholder and the missing-file row.

### WEB-04: Late-arrival texture upload re-renders only the affected mesh

- **Target environment:** web
- **User intent:** A user opens a scene with a missing texture, then gives the file later through an upload control. Only the mesh that depends on the missing file renders again. The rest of the scene does not change.
- **Steps:**
  1. Select `scenes/fixtures/test-missing-texture.tscn`. Confirm the magenta placeholder as in WEB-03.
  2. In the **Resources** tab, upload a real PNG on the `res://textures/test-upload.png` row. Any small PNG works, for example `scenes/fixtures/textures/normal-bumps.png`.
  3. Wait for the canvas to settle (no further network requests for 500 ms).
  4. Re-sample the rendered mesh's center pixel.
  5. Inspect the scene-tree panel and confirm no nodes were added or removed.
- **Expected observable outcomes:**
  - Step 3: The mesh that was magenta shows the uploaded texture. The sampled pixel is not magenta and is in a non-placeholder color range.
  - Step 4: The row for that path shows the ✓ uploaded state.
  - Step 5: The tree is the same after the upload: only the texture changed, not the structure.
  - No full-scene rebuild occurs. The camera position from earlier orbiting stays (WEB-07 is the explicit camera test).
- **Features covered:** PRD US-3, US-5b.
- **Screenshot points:**
  - SCREENSHOT WEB-04-a: placeholder magenta before upload (cross-reference WEB-03-a).
  - SCREENSHOT WEB-04-b: textured mesh after upload.

### WEB-05: Shared texture late-arrival updates every dependent mesh

- **Target environment:** web
- **User intent:** A user has a scene where several meshes share one texture. When the shared file loads, every dependent mesh updates at the same time, and none is skipped.
- **Steps:**
  1. Select `scenes/fixtures/test-multiple-meshes-shared-texture.tscn`. In this fixture `Mesh1` and `Mesh2` reference the same material, which references `res://textures/shared.png`. `Mesh3` references a different material backed by `res://textures/different.png`. Both texture files are absent from the repo.
  2. Confirm all three meshes show magenta placeholders (cross-reference WEB-03).
  3. Upload a real PNG on the `res://textures/shared.png` row.
  4. Wait for the canvas to settle.
  5. Sample the center pixel of each of the three meshes individually.
- **Expected observable outcomes:**
  - Step 4: `Mesh1` and `Mesh2` both show the uploaded texture and are not magenta.
  - Step 5: `Mesh3` remains magenta (its texture, `different.png`, is still missing).
  - The updates to `Mesh1` and `Mesh2` complete in the same animation frame, with no visible lag between them in a screen recording.
- **Features covered:** PRD US-5b, US-25.
- **Screenshot points:**
  - SCREENSHOT WEB-05-a: all three meshes magenta before upload.
  - SCREENSHOT WEB-05-b: `Mesh1`/`Mesh2` textured, `Mesh3` still magenta after upload.

### WEB-06: Click a mesh in the viewport selects it in the tree

- **Target environment:** web
- **User intent:** A user clicks a mesh in the 3D viewport. The scene-tree panel highlights its node, and the details panel shows its properties.
- **Steps:**
  1. Select `scenes/fixtures/integration-three-cubes.tscn`.
  2. Wait for the canvas to settle.
  3. Click on the canvas at the screen position of the rightmost cube.
  4. Read the scene-tree panel's selected entry.
  5. Read the node-details panel.
  6. Click an unselected tree entry (for example, the leftmost cube's tree row).
  7. Re-read the details panel.
- **Expected observable outcomes:**
  - Step 4: The tree entry corresponding to the rightmost cube is highlighted as selected.
  - Step 5: The details panel shows the rightmost cube's transform, mesh, and material properties.
  - Step 7: The details panel now shows the leftmost cube's properties, and the tree highlight has moved.
  - The viewport's selected-mesh highlight (outline, glow, or equivalent) also moves to match.
- **Features covered:** PRD US-6.
- **Screenshot points:**
  - SCREENSHOT WEB-06-a: rightmost cube selected by a viewport click.
  - SCREENSHOT WEB-06-b: leftmost cube selected by a tree click.

### WEB-07: Camera orbit survives a content-only hot reload

- **Target environment:** web
- **User intent:** A user has orbited the camera around a scene. A saved edit to the file's content (not a switch to a different file) must not reset the viewpoint.
- **Steps:**
  1. Select `scenes/fixtures/unit-box-mesh.tscn`.
  2. Rotate the camera to a non-default angle (middle-drag the canvas by approximately 45° azimuth, 20° elevation).
  3. Record the camera position and target with `browser_evaluate`, from the controls state.
  4. Change the fixture file's content (for example, a transform value) and save. The Vite HMR pipeline sends the change to the open page.
  5. Wait for the canvas to settle.
  6. Re-record the camera position and target.
- **Expected observable outcomes:**
  - Step 5: The mesh's transform reflects the edit.
  - Step 6: Camera position and target are equal to the values recorded in step 3 within 0.001 units of tolerance (component identity preserved across content-only re-render).
- **Features covered:** PRD US-8.
- **Screenshot points:**
  - SCREENSHOT WEB-07-a: orbited camera before edit.
  - SCREENSHOT WEB-07-b: same camera angle after edit, with mesh transform changed.

### WEB-08: Generic-node fallback keeps unsupported types discoverable

- **Target environment:** web
- **User intent:** A user opens a scene with node types the renderer does not draw. Each node stays in the scene tree and does not disappear.
- **Steps:**
  1. Select `scenes/fixtures/unit-unsupported-nodes.tscn`.
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel.
  4. Confirm the registered types render per their registrations and the unregistered type is flagged in the tree.
- **Expected observable outcomes:**
  - Step 3: The tree contains `PhysicsArea`, `AnimPlayer`, `GameTimer`, `Title` and `Description`, as parsed.
  - Step 4: `Area3D` (PhysicsArea) and `Timer` (GameTimer) render as transform-only groups (ADR-0005/ADR-0008). `AnimationPlayer` (AnimPlayer) renders and plays its clips through the Animation transport (ADR-0011/0012). None of the three is flagged. A type with no registration renders through `<GenericNodeFallback>` as an invisible transform-only group, with no placeholder gizmo in the viewport (ADR-0008). The tree tags such a type, and a `pending` one such as `GPUParticles2D` in `scenes/fixtures/example-dodge-player.tscn`, with a "Not Implemented" chip.
  - The `Label3D` nodes (`Title`, `Description`) render as billboarded 3D text through their registered component.
  - No uncaught console errors.
- **Features covered:** PRD US-11.
- **Screenshot points:**
  - SCREENSHOT WEB-08-a: scene tree showing the "Not Implemented" chip on `GPUParticles2D` in `scenes/fixtures/example-dodge-player.tscn`.

### WEB-09: Helper gizmos visible for lights and cameras

- **Target environment:** web
- **User intent:** A user wants to see where the lights and cameras are in the scene, because those nodes have no geometry of their own.
- **Steps:**
  1. Select `scenes/fixtures/integration-lights-all-types.tscn`.
  2. Wait for the canvas to settle.
  3. Look for visible gizmo primitives at the transforms of `DirectionalLight3D`, `OmniLight3D`, and `SpotLight3D`.
  4. Switch to `scenes/fixtures/unit-camera-basic.tscn`.
  5. Look for a visible camera gizmo at the camera's transform.
- **Expected observable outcomes:**
  - Step 3: Three different gizmo helpers are visible at the three light positions. The shapes match the light type (arrow for directional, sphere/billboard for omni, cone or frustum for spot).
  - Step 5: A camera-frustum or equivalent gizmo is visible at the camera position.
- **Features covered:** PRD US-7.
- **Screenshot points:**
  - SCREENSHOT WEB-09-a: three light gizmos visible.
  - SCREENSHOT WEB-09-b: camera gizmo visible.

### WEB-10: Malformed fixture shows an error without crashing

- **Target environment:** web
- **User intent:** A user has saved a malformed `.tscn` file by mistake. The previewer shows the error and the rest of the app stays responsive. The page does not go blank.
- **Steps:**
  1. Select `scenes/fixtures/edge-malformed-bracket.tscn` (its closing brackets are missing on purpose).
  2. Wait for the canvas to settle.
  3. Inspect the page for an error message or banner.
  4. Switch back to `scenes/fixtures/unit-box-mesh.tscn`.
- **Expected observable outcomes:**
  - Step 3: A visible error indicator describes the parse failure, or at least reports that the scene could not render. The app does not crash, and the canvas and panels stay interactive.
  - Step 4: The well-formed fixture loads normally, with no error state left over.
- **Features covered:** PRD US-5 (errors surface clearly), defensive behavior of the lenient parser.
- **Screenshot points:**
  - SCREENSHOT WEB-10-a: error indicator visible after loading malformed fixture.

## VSCODE flows

The VS Code extension opens a webview Preview panel for a `.tscn` file with the **`textscene.openPreviewToSide`** command: the command palette entry "TextScene: Open Preview to the Side" and an editor-title button. There is no `customEditors` contribution. The extension also has language features (document-link, definition and document-symbol providers). The verifier drives the Extension Development Host with the `drive-vscode-extension` skill. All fixture paths assume that the verifier opened this repo's root as the workspace folder.

### VSCODE-01: Preview opens for a .tscn file with the preview command

- **Target environment:** vscode
- **User intent:** A user opens a `.tscn` file in VS Code and opens the rendered preview beside it.
- **Steps:**
  1. Launch the Extension Development Host with this repo as the workspace.
  2. Open `scenes/fixtures/unit-box-mesh.tscn` in a text editor (so it is the active editor), then run `vscode.commands.executeCommand('textscene.openPreviewToSide')`. The editor-title button and the command palette entry "TextScene: Open Preview to the Side" run the same command. A webview panel titled `Preview: unit-box-mesh.tscn` opens in the side editor group.
  3. Wait for the webview to load (poll for the webview's canvas to have non-zero dimensions).
- **Expected observable outcomes:**
  - Step 3: A webview panel is open showing the rendered box. The scene-tree panel inside the webview lists the `Node3D` root and a `MeshInstance3D` child.
  - No uncaught extension-host errors in the Extension Development Host output channel.
- **Features covered:** PRD US-1, US-27.
- **Screenshot points:**
  - SCREENSHOT VSCODE-01-a: VS Code window with preview panel open beside the source.

### VSCODE-02: Hot reload propagates a property edit on save

- **Target environment:** vscode
- **User intent:** A user edits a property in the open `.tscn` file, saves, and sees the change within a frame or two.
- **Steps:**
  1. With `scenes/fixtures/unit-box-mesh.tscn` open in the preview, open the same file in a text editor in the workspace.
  2. Change the transform (for example, the box's translation X from 0 to 3 on a `transform = Transform3D(...)` line).
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

### VSCODE-03: Two preview panels update independently

- **Target environment:** vscode
- **User intent:** A user opens two different scenes side by side. An edit to one does not affect the other, and each panel has its own selection state.
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
  - After step 5: Each webview's selection matches its own click. A selection in one does not change the other's selection.
  - Step 7: Webview 1 reflects the new property. Webview 2's `unit-sphere-mesh.tscn` rendering is unchanged.
  - No cross-talk between panels (no spurious re-renders in panel 2 when panel 1 is edited).
- **Features covered:** PRD US-4.
- **Screenshot points:**
  - SCREENSHOT VSCODE-03-a: two preview panels open side by side with different scenes.
  - SCREENSHOT VSCODE-03-b: independent selection state in each panel.

### VSCODE-04: Ctrl/Cmd-click on a `res://` path navigates to the file

- **Target environment:** vscode
- **User intent:** A user is reading a `.tscn` file and wants to jump to the file referenced by a `res://` path.
- **Steps:**
  1. Open `scenes/fixtures/unit-external-material.tscn` in the text editor.
  2. Locate an `ext_resource ... path="res://..."` line.
  3. Ctrl-click (or Cmd-click on macOS) the `res://` path token. The verifier may call the link provider directly with `vscode.commands.executeCommand('vscode.executeLinkProvider', uri)`.
- **Expected observable outcomes:**
  - The editor opens the referenced file (`scenes/fixtures/materials/...` or similar, as the fixture references it).
  - The active editor's URI now matches the referenced file.
  - No "no definition found" message appears.
- **Features covered:** PRD US-9. This exercises `TscnDocumentLinkProvider`. `TscnDefinitionProvider` answers `SubResource("id")` and `ExtResource("id")` tokens instead.
- **Screenshot points:**
  - SCREENSHOT VSCODE-04-a: Ctrl-click target highlighted before click.
  - SCREENSHOT VSCODE-04-b: referenced file opened after click.

### VSCODE-05: Outline panel lists scene tree nodes

- **Target environment:** vscode
- **User intent:** A user uses the Outline panel to navigate a large scene without scrolling through the text.
- **Steps:**
  1. Open `scenes/fixtures/example-hierarchy-deep.tscn` in the text editor.
  2. Open the Outline view (`workbench.view.outline`).
  3. Read the outline tree's content.
  4. Click a node entry in the outline.
- **Expected observable outcomes:**
  - Step 3: The outline shows the scene hierarchy from the file: the root node and children in the correct nesting order, names matching the `[node name="..."]` declarations.
  - Step 4: The editor scrolls to the matching `[node ...]` line in the text and selects it.
- **Features covered:** PRD US-10. This exercises `TscnDocumentSymbolProvider`.
- **Screenshot points:**
  - SCREENSHOT VSCODE-05-a: outline panel showing a nested hierarchy.

### VSCODE-06: Click a mesh in the webview viewport selects it in the tree

- **Target environment:** vscode
- **User intent:** Same as WEB-06, but inside the VS Code webview, to confirm that click-to-select works in the webview's restricted environment.
- **Steps:**
  1. Open `scenes/fixtures/integration-three-cubes.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Wait for the webview canvas to settle.
  3. Click on the webview canvas at the screen position of the middle cube.
  4. Read the webview's scene-tree panel for the selected entry.
  5. Click a different tree row (the leftmost cube's row).
  6. Re-read the details panel.
- **Expected observable outcomes:**
  - Step 4: The middle cube's tree entry is selected, and the details panel shows its properties.
  - Step 6: The details panel shows the leftmost cube's properties.
- **Features covered:** PRD US-6.
- **Screenshot points:**
  - SCREENSHOT VSCODE-06-a: middle cube selected in the webview.

### VSCODE-07: Missing-file scene renders placeholder in the extension

- **Target environment:** vscode
- **User intent:** Same scenario as WEB-03, but inside the VS Code webview. Path resolution uses the webview's `asWebviewUri` and the workspace-relative `res://` resolution.
- **Steps:**
  1. Open `scenes/fixtures/test-missing-texture.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Wait for the webview canvas to settle.
  3. Read the canvas pixel data at the rendered mesh's screen position.
  4. Open the **Resources** tab and read the missing-file rows.
- **Expected observable outcomes:**
  - Step 3: The mesh is visible, in the magenta placeholder color.
  - Step 4: A row names `res://textures/test-upload.png`.
  - No webview console errors that crash the panel. A `warn` log is acceptable.
- **Features covered:** PRD US-5, US-5a, US-5c, US-26.
- **Screenshot points:**
  - SCREENSHOT VSCODE-07-a: webview showing magenta placeholder.

### VSCODE-08: Camera survives save inside the webview

- **Target environment:** vscode
- **User intent:** Same as WEB-07, but inside the webview, to confirm that the camera state survives a save in the file-watcher hot reload path.
- **Steps:**
  1. Open `scenes/fixtures/unit-box-mesh.tscn` and run `textscene.openPreviewToSide` to open its preview.
  2. Orbit the webview camera to a non-default angle.
  3. Record the camera state with `webview.postMessage(...)`, or by exposing it on `globalThis` for the verifier to read.
  4. Edit the file's content in the text editor (for example, the box translation).
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

## BOTH flows (executed in both environments)

A verifier runs each `BOTH-` flow twice: once against the web app and once against the Extension Development Host. The expected outcomes are the same. Only the harness differs.

### BOTH-01: Integration scene renders all primitives, lights and surface materials

- **Target environment:** both
- **User intent:** A user opens the integration fixture and sees every primitive, light and material variation rendered correctly together.
- **Steps:**
  1. Open `scenes/fixtures/integration-all-primitives.tscn` (web: scene palette; vscode: `textscene.openPreviewToSide` preview).
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel.
  4. Inspect the canvas for visible primitives.
- **Expected observable outcomes:**
  - Step 3: The tree contains `Root`, `Floor` (PlaneMesh), `Capsule`, `Torus`, `Prism`, `BackWall`, `DirectionalLight` and `FillLight`, as the fixture's `[node ...]` entries declare.
  - Step 4: All five non-floor primitives are visible at their transforms. The floor and back wall are also visible. TorusMesh and PrismMesh render through their registered components.
  - The lighting is not flat: the shadow side of the capsule is darker than the lit side, so the directional light has an effect.
- **Features covered:** PRD US-1, US-2, US-7 (gizmos for lights), US-11 (Torus and Prism).
- **Screenshot points:**
  - SCREENSHOT BOTH-01-a: integration-all-primitives in this environment.

### BOTH-02: Every mesh primitive renders with its own shape

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
  - Each shape is distinct (the sphere is round, the plane is flat, and so on).
  - Cross-reference WEB-02 / VSCODE-01.
- **Features covered:** per-type fixture rendering.
- **Screenshot points:**
  - SCREENSHOT BOTH-02-a through -e: one screenshot per primitive.

### BOTH-03: All three light types render with visible gizmos and illumination

- **Target environment:** both
- **User intent:** A user opens a scene that contains a DirectionalLight3D, an OmniLight3D and a SpotLight3D, and confirms that all three show a gizmo and light the meshes near them.
- **Steps:**
  1. Open `scenes/fixtures/integration-lights-all-types.tscn`.
  2. Wait for the canvas to settle.
  3. Read the scene-tree panel: confirm `DirectionalLight3D`, `OmniLight3D`, `SpotLight3D` are present.
  4. Visually inspect for gizmo helpers at each light's transform.
  5. Load `scenes/fixtures/integration-mixed-nodes.tscn`, which contains lights and meshes, and confirm the shading varies across the meshes. The first fixture has no meshes by design.
- **Expected observable outcomes:**
  - Step 4: Three gizmo helpers visible, shapes match light type (arrow / point / cone).
  - Step 5 (mixed-nodes fixture): the meshes show shading that matches several light sources, such as colored highlights from the spot light's tint.
- **Features covered:** PRD US-7.
- **Screenshot points:**
  - SCREENSHOT BOTH-03-a: all-lights fixture with three gizmos visible.
  - SCREENSHOT BOTH-03-b: mixed-nodes fixture showing illumination on meshes.

### BOTH-04: WorldEnvironment changes scene atmosphere

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
  - Step 5: The background color differs from step 3, so the WorldEnvironment node drives the visible state and no hard-coded default does.
- **Features covered:** PRD US-1.
- **Screenshot points:**
  - SCREENSHOT BOTH-04-a: basic WorldEnvironment fixture.
  - SCREENSHOT BOTH-04-b: no-fog WorldEnvironment fixture for comparison.

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

User stories 12 through 24 and 28 are for developers and maintainers, and no user flow covers them.

## Notes for verifiers

- **Audio gizmo.** `AudioStreamPlayer3D` has a speaker-cone gizmo, shown when the node is selected. `AudioStreamPlayer` and `AudioStreamPlayer2D` are registered as non-visual nodes. No flow in this document covers an audio-player gizmo. `scenes/fixtures/unit-audio-stream-player.tscn` has one.
- **Fixture-content drift.** If a fixture's content differs from a step here, the fixture is the ground truth. Update the step in this document.
- **Step ambiguity.** If two interpretations of a step lead to different observable outcomes, record both and make the step clear in this document.
- **Screenshot naming.** Use the `SCREENSHOT <flow-id>-<letter>` token, in lower case, as the file name stem of the captured image, for example `web-04-b.png`. The user guides embed the image by that name.
