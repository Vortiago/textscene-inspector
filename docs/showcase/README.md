# Feature Showcase

A living visual record of what TextScene Inspector renders today. Every clip below is a real `.webm` screen recording of the actual renderer — not a mockup — paired with a `.png` poster frame. Each recording opens directly on its own scene, so the feature is framed and lit from the first frame.

Regenerate the whole set after any UI change with one command — **`pnpm showcase:regen`** (see [Regenerate](#regenerate)). These clips are how we track progress, so re-run it whenever the renderer or chrome changes and commit the refreshed `.webm`/`.png` alongside the code.

## Hallway progress

A self-contained hallway scene is the yardstick for "can it render a full scene". Triplanar (`uv1_world_triplanar`) tiling matches Godot's world-unit density on planar meshes (floor/walls/ceiling tile `size × uv1_scale` instead of stretching one copy); non-planar triplanar geometry remains approximate.

### CSG hallway mockup

![hallway](web/hallway.png)

[▶ web/hallway.webm](web/hallway.webm)

The hallway mockup: CSG corridor (floor / walls / ceiling), portrait frames, and Label3D name plates — self-contained, tracks 3D-rendering progress.

## Split Dock chrome + 2D UI

### dcc-layout

![dcc-layout](web/dcc-layout.png)

[▶ web/dcc-layout.webm](web/dcc-layout.webm)

The shipped chrome is a 2-column **Split Dock** (ADR-0007): the viewport alongside a single right dock holding the scene tree on top and the tabbed detail panel (**Inspector** / **Resources** / **Cameras**) directly below — no left rail. The top bar carries the brand, the scene chip + Ctrl/Cmd+K palette, and the Reset Camera / 3D-2D / Collisions controls. The clip orbits the textured hallway mockup, then switches to a 2D-UI example scene and flips to **2D** mode so the native Control canvas renders the dialog UI — note that it was recorded against the earlier 3-column layout and needs a re-run (`pnpm showcase:regen`) to show the Split Dock. Until then, this still captures the current toolbar:

![Current toolbar with the scene chip's Ctrl/Cmd+K command palette open](../screenshots/j-integration/web-toolbar-palette.png)

### ui-hint

![ui-hint](web/ui-hint.png)

[▶ web/ui-hint.webm](web/ui-hint.webm)

ADR-0006 discoverability: a Control-only scene (`example-ui-dialog`) opens in the default 3D viewport, so the shell floats a **"Contains 2D UI — switch to 2D"** hint over the canvas. Clicking it flips to 2D mode, which renders the dialog.

## Feature clips

One clip per implemented feature.

### all-primitives

![all-primitives](web/all-primitives.png)

[▶ web/all-primitives.webm](web/all-primitives.webm)

A green ground plane holds primitive meshes (prism, torus, capsule), each with its own material, orbited as solid 3D geometry.

### all-meshes

![all-meshes](web/all-meshes.png)

[▶ web/all-meshes.webm](web/all-meshes.webm)

Every primitive mesh type — cube, sphere, cylinder, capsule, plane, torus, prism — rendered together with distinct materials.

### csg-box

![csg-box](web/csg-box.png)

[▶ web/csg-box.webm](web/csg-box.webm)

CSGBox3D shapes render as solid lit geometry with materials (not placeholders).

### csg-cylinder

![csg-cylinder](web/csg-cylinder.png)

[▶ web/csg-cylinder.webm](web/csg-cylinder.webm)

CSGCylinder3D renders as a solid cylinder, including the tapered cone form.

### material-metallic

![material-metallic](web/material-metallic.png)

[▶ web/material-metallic.webm](web/material-metallic.webm)

A high-metallic, low-roughness StandardMaterial3D sphere with a tight specular highlight under the directional light.

### material-emissive

![material-emissive](web/material-emissive.png)

[▶ web/material-emissive.webm](web/material-emissive.webm)

An emissive material self-illuminates uniformly regardless of light direction.

### world-environment

![world-environment](web/world-environment.png)

[▶ web/world-environment.webm](web/world-environment.webm)

WorldEnvironment fills the background with its color and ambient-lights the scene.

### label3d

![label3d](web/label3d.png)

[▶ web/label3d.webm](web/label3d.webm)

Label3D billboarded 3D text nodes with color and outline variations, facing the camera.

### mixed-nodes

![mixed-nodes](web/mixed-nodes.png)

[▶ web/mixed-nodes.webm](web/mixed-nodes.webm)

A mixed node hierarchy of multiple mesh instances rendered together with correct lighting.

### physics-bodies

![physics-bodies](web/physics-bodies.png)

[▶ web/physics-bodies.webm](web/physics-bodies.webm)

StaticBody3D / Area3D render as transform groups positioning their child meshes; AudioStreamPlayer renders nothing visible.

### multi-camera

![multi-camera](web/multi-camera.png)

[▶ web/multi-camera.webm](web/multi-camera.webm)

Selecting each Camera3D node and clicking "Use This Camera" switches the viewport between the cameras' points of view (perspective, top-down, side, orthographic), then resets to free orbit. The video actively switches the active camera between the Camera3D nodes.

### missing-upload

![missing-upload before](web/missing-upload-before.png)

![missing-upload after](web/missing-upload.png)

[▶ web/missing-upload.webm](web/missing-upload.webm)

Request-missing-resources, then upload them and watch them get used — end to end. A small room whose floor, walls, and crate reference textures that are **not** bundled loads flat-shaded in **magenta** (the missing-texture marker), and the shell's **Resources** tab lists all three `res://demo/missing/*` paths as missing (⚠). Uploading a file for each path drives the late-arrival pipeline (`provideFile` → `useResource` `'loaded'` → re-render): the rows flip to uploaded (✓) and the surfaces gain their textures **live, on camera**. The two posters above are the before (missing/magenta) and after (uploaded/textured) frames.

## VS Code extension

Both editions render through the same `@textscene/core` library, so every clip above is also the VS Code 3D rendering output — the web previewer and the extension share one renderer. On top of that shared rendering, VS Code adds a command-opened `.tscn` Preview panel (**TextScene: Open Preview to the Side** from the command palette or the editor-title button) with the scene tree and inspector. The screenshots below prove the integration runs inside the full VS Code UI: title bar, activity bar, editor tabs, the `.tscn` text editor, the Preview panel, and the status bar.

![VS Code: the Preview webview rendering a CSG hallway mockup — floor, walls, portrait frames — beside the Explorer and scene tree](../screenshots/vscode/vscode-hallway.png)

The **TextScene: Open Preview to the Side** webview fills the editor area, rendering `example-hallway-mockup.tscn` in 3D (63 nodes: floor, walls, portrait frames) with the searchable scene tree, the Inspector/Resources/Cameras panel, and the viewport toolbar (Reset Camera, 2D/3D toggle, Collisions/Labels/Navigation/Grid) — all inside the standard VS Code layout.

![VS Code: the Preview webview in 2D mode rendering a Control-node "Field Journal" dialog](../screenshots/vscode/vscode-main.png)

The same preview in 2D mode renders `example-ui-dialog.tscn`: a Godot `Control` UI tree (panel, body copy, Save Entry / Close buttons) drawn in the pan/zoom viewport, with the `JournalUI` node tree in the inspector.

![VS Code: the box fixture's Preview panel filling the editor area](../screenshots/vscode/both-02-a.png)

`unit-box-mesh.tscn` with its source closed, so the webview owns the editor area: the expanded scene tree (Root → Box / Title / Description), the Inspector/Resources/Cameras tabs and the viewport toolbar, beside the Explorer.

![VS Code: a lights-only fixture, its three light nodes listed in the scene tree](../screenshots/vscode/both-03-a.png)

`integration-lights-all-types.tscn` holds a DirectionalLight3D, an OmniLight3D and a SpotLight3D and no geometry, so the tree carries what the viewport cannot.

![VS Code: the Outline view, the .tscn source and the Preview panel together](../screenshots/vscode/vscode-05-a.png)

`example-hierarchy-deep.tscn` with the Outline expanded beside the source and the preview. The document symbols mirror the scene's own `[node name=…]` nesting, so an outline click jumps the editor to that declaration.

Every VS Code screenshot in this repo, the two above and the 22 in
[docs/user-guide-vscode.md](../user-guide-vscode.md), is regenerated by
`node scripts/showcase/vscode/capture.mjs`. It drives the extension dev-host
cross-platform, headless under `xvfb-run` on Linux (software GL), or against an
installed or `$VSCODE_BIN` build elsewhere, and drives the workbench into each
shot's state rather than shooting whatever the last one left open.

## Coming soon (re-run to capture)

Planned or in flight; re-run the showcase to capture them once they land:

- A furnished hallway variant — photo frames and props — as a stretch goal for scene-corpus breadth.
- A dedicated lit-scene lighting demo.
- A re-recorded `dcc-layout` clip showing the 2-column Split Dock chrome (the current clip predates ADR-0007).

(Shipped since the last revision: multiline-quoted-string joining — two-line labels now render both lines (`parser/TscnParserCore.ts`, guarded by `multilineStrings.test.ts`) — plus the 2D-UI overlay + 2D/3D toggle and the collision-shape wireframe toggle, both visible in the `dcc-layout` clip above.)

## Regenerate

Run the whole pipeline with **one command** — do this after any UI change, since these clips are how we track progress:

```bash
pnpm showcase:regen
```

It builds the web previewer, starts a preview server, records every scenario in `scripts/showcase/scenarios.mjs` to `web/*.webm` (+ poster `.png`), then shuts the server down. Add a scenario to `scenarios.mjs` for each new feature so it gets its own clip.

During iteration, with a preview server already running, capture a single clip: `node scripts/showcase/run.mjs <name>`.
