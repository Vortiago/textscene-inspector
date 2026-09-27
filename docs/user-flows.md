# User flows

A user flow is a scenario a verifier runs by hand against the web previewer or the VS Code extension. Each flow runs on its own and gives the same result every time.

## Conventions

- The ID prefix gives the host: `WEB-`, `VSCODE-`, or `BOTH-` (run once in each).
- Fixtures are in `scenes/fixtures/`. `res://` resolves to that directory. Use only fixtures that exist.
- "Settle" means no network request for 500 ms.
- A screenshot point `<ID>-<letter>` is saved as `docs/screenshots/<host>/<id>-<letter>.png`, in lower case.
  `node scripts/showcase/vscode/capture.mjs` captures the VS Code set.
- If a fixture and a step disagree, the fixture is right. Update the step.
- If a step has two readings with different results, record both and make the step clear.

## Web flows

Start the dev server with `pnpm dev:web`. Drive it with Playwright. Open a fixture from the scene palette (<kbd>Ctrl/Cmd+K</kbd>).

### WEB-01: The app opens on a rendered scene

1. Open `http://localhost:3000`.
2. Wait for a `<canvas>` with a width and height above 0.
3. Read the canvas pixels.

Expected:
- The page title contains "TextScene".
- Some pixels differ from the clear colour.
- No uncaught console error.

Screenshot: WEB-01-a, the page after load.

### WEB-02: Every unit fixture loads

1. Open each fixture and let it settle:
   `unit-empty-scene`, `unit-node3d-basic`, `unit-mesh-instance-basic`, `unit-box-mesh`, `unit-sphere-mesh`,
   `unit-plane-mesh`, `unit-cylinder-mesh`, `unit-capsule-mesh`, `unit-camera-basic`, `unit-world-environment-basic`.
2. Read the scene tree after each one.

Expected:
- The tree shows the expected root. For example, `unit-box-mesh` has a `MeshInstance3D`.
- `unit-empty-scene` shows the background only, with no crash.
- No uncaught console error.

Screenshots: WEB-02-a to -e, the box, sphere, plane, cylinder and capsule.

### WEB-03: A missing texture renders magenta

1. Open `test-missing-texture.tscn`. It uses `res://textures/test-upload.png`, which does not exist.
2. Sample the centre pixel of `TestMesh`.
3. Open the **Resources** tab.

Expected:
- The mesh is visible and magenta.
- A row names `res://textures/test-upload.png`.
- A `warn` log names the path. No uncaught console error.

Screenshot: WEB-03-a.

### WEB-04: An upload fixes only the affected mesh

1. Open `test-missing-texture.tscn`.
2. In **Resources**, upload a PNG on the `res://textures/test-upload.png` row. `scenes/fixtures/textures/normal-bumps.png` works.
3. Let it settle.
4. Sample the mesh again.
5. Read the scene tree.

Expected:
- The mesh shows the texture, not magenta.
- The row shows ✓.
- The tree is unchanged. The camera does not move.

Screenshots: WEB-04-a before, WEB-04-b after.

### WEB-05: A shared texture updates every mesh that uses it

`test-multiple-meshes-shared-texture.tscn`: `Mesh1` and `Mesh2` use `res://textures/shared.png`. `Mesh3` uses `res://textures/different.png`. Both files are missing.

1. Open the fixture. All three meshes are magenta.
2. Upload a PNG on the `res://textures/shared.png` row.
3. Sample each mesh.

Expected:
- `Mesh1` and `Mesh2` show the texture, in the same frame.
- `Mesh3` stays magenta.

Screenshots: WEB-05-a before, WEB-05-b after.

### WEB-06: A click selects a mesh

1. Open `integration-three-cubes.tscn`.
2. Click the rightmost cube in the viewport.
3. Read the scene tree and the **Inspector**.
4. Click the leftmost cube's row in the tree.
5. Read the **Inspector**.

Expected:
- After step 2, the tree and the Inspector show the rightmost cube.
- After step 4, both show the leftmost cube. The viewport highlight moves too.

Screenshots: WEB-06-a viewport click, WEB-06-b tree click.

### WEB-08: A type that does not draw stays in the tree

1. Open `unit-unsupported-nodes.tscn`.
2. Read the scene tree.

Expected:
- The tree holds `PhysicsArea`, `AnimPlayer`, `GameTimer`, `Title` and `Description`.
- `Area3D` and `Timer` are invisible transform groups (ADR-0005, ADR-0008). `AnimationPlayer` plays through the timeline (ADR-0011, ADR-0012).
- `Title` and `Description` render as Label3D text.
- A type with no registration, or a `pending` one, has a **Not Implemented** chip in the tree. `GPUParticles2D` in `example-dodge-player.tscn` is one.
- No uncaught console error.

Screenshot: WEB-08-a, the chip on `GPUParticles2D` in `example-dodge-player.tscn`.

### WEB-09: Lights and cameras have gizmos

1. Open `integration-lights-all-types.tscn`.
2. Look at each light's position.
3. Open `unit-camera-basic.tscn`.
4. Look at the camera's position.

Expected:
- SpotLight3D: a cone. OmniLight3D: a sphere at its range. DirectionalLight3D: an octahedron.
- Camera3D: a frustum.

Screenshots: WEB-09-a lights, WEB-09-b camera.

### WEB-10: A malformed file shows an error

1. Open `edge-malformed-bracket.tscn`.
2. Look for an error.
3. Open `unit-box-mesh.tscn`.

Expected:
- A red banner shows the parse error. The app stays usable.
- The box loads normally, with no error left over.

Screenshot: WEB-10-a.

## VS Code flows

Drive the Extension Development Host with the `drive-vscode-extension` skill. Open the repository root as the workspace. The preview command is `textscene.openPreviewToSide`.

### VSCODE-01: The preview opens beside the source

1. Open `unit-box-mesh.tscn`.
2. Run `textscene.openPreviewToSide`.
3. Wait for the webview canvas to have a size above 0.

Expected:
- A panel titled `Preview: unit-box-mesh.tscn` opens in the side group.
- The tree shows the `Node3D` root and a `MeshInstance3D` child.
- The extension host logs no uncaught error.

Screenshot: VSCODE-01-a.

### VSCODE-02: A save updates the preview

1. Open the preview of `unit-box-mesh.tscn`.
2. Change the box's translation X from 0 to 3.
3. Save.

Expected:
- Within 2 seconds, the box moves and the Inspector shows `Position X: 3.000`.
- The panel stays open.

Screenshots: VSCODE-02-a before, VSCODE-02-b after.

### VSCODE-03: Two previews are independent

1. Open the previews of `unit-box-mesh.tscn` and `unit-sphere-mesh.tscn` in two groups.
2. Select the mesh in each.
3. Edit and save `unit-box-mesh.tscn`.

Expected:
- Each panel keeps its own selection.
- Only the box panel updates.

Screenshots: VSCODE-03-a two panels, VSCODE-03-b two selections.

### VSCODE-04: Ctrl-click on a `res://` path opens the file

1. Open `unit-external-material.tscn`.
2. Ctrl-click (Cmd-click on macOS) the `res://` path on an `ext_resource` line.

Expected: the referenced file opens.

Screenshots: VSCODE-04-a before, VSCODE-04-b after.

### VSCODE-05: The Outline lists the scene tree

1. Open `example-hierarchy-deep.tscn`.
2. Open the Outline view.
3. Click an entry.

Expected:
- The Outline nests `Level0`, `Level1` and `Level2` as the file does.
- The editor jumps to that `[node]` line.

Screenshot: VSCODE-05-a.

### VSCODE-06: A click selects a node in the webview

1. Open the preview of `integration-three-cubes.tscn`.
2. Click the middle cube in the viewport.
3. Click the leftmost cube's row in the tree.

Expected:
- After step 2, the tree and the Inspector show the middle cube.
- After step 3, they show the leftmost cube.

Screenshot: VSCODE-06-a.

### VSCODE-07: A missing texture renders magenta

1. Open the preview of `test-missing-texture.tscn`.
2. Sample the mesh.
3. Open the **Resources** tab.

Expected:
- The mesh is magenta.
- A row names `res://textures/test-upload.png`.
- The panel does not crash. A `warn` log is allowed.

Screenshot: VSCODE-07-a.

### VSCODE-08: The camera survives a save

1. Open the preview of `unit-box-mesh.tscn`.
2. Orbit the camera.
3. Change the box's translation and save.

Expected:
- The box moves.
- The camera does not move.

Screenshots: VSCODE-08-a before, VSCODE-08-b after.

## Flows for both hosts

### BOTH-01: The integration scene renders

1. Open `integration-all-primitives.tscn`.
2. Read the scene tree.
3. Look at the viewport.

Expected:
- The tree holds `Root`, `Floor`, `Capsule`, `Torus`, `Prism`, `BackWall`, `DirectionalLight` and `FillLight`.
- The primitives are visible. The shadow side of the capsule is darker than the lit side.

Screenshot: BOTH-01-a.

### BOTH-02: Each primitive has its own shape

Open `unit-box-mesh`, `unit-sphere-mesh`, `unit-plane-mesh`, `unit-cylinder-mesh` and `unit-capsule-mesh`.

Expected: one mesh of the correct shape each, and no error.

Screenshots: BOTH-02-a to -e.

### BOTH-03: Lights have gizmos and light meshes

1. Open `integration-lights-all-types.tscn`. It has three lights and no meshes.
2. Open `integration-mixed-nodes.tscn`.

Expected:
- Step 1: a gizmo at each light.
- Step 2: the top faces of the cubes are brighter than their sides.

Screenshots: BOTH-03-a lights, BOTH-03-b meshes.

### BOTH-04: WorldEnvironment sets the background

1. Open `unit-world-environment-basic.tscn`.
2. Sample a corner pixel with no mesh.
3. Open `unit-world-environment-no-fog.tscn`.
4. Sample the same pixel.

Expected: each background matches its WorldEnvironment, and the two differ.

Screenshots: BOTH-04-a, BOTH-04-b.
