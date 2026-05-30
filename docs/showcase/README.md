# Feature Showcase

This is a living visual record of features implemented in TextScene Inspector. Every clip below is a real screen recording (`.webm`) of the web previewer rendering an actual `.tscn` fixture, with a `.png` poster frame for quick preview. These captures are re-generated as new features land, so this page tracks what the renderer can actually do today.

## Clips

### Primitive meshes (box/sphere/cylinder/plane/capsule/torus/prism)

![Primitive meshes (box/sphere/cylinder/plane/capsule/torus/prism)](web/all-primitives.png)

[▶ web/all-primitives.webm](web/all-primitives.webm)

A large green ground plane holds a cluster of distinct primitive meshes — a magenta triangular prism, an orange torus, and a blue capsule — each shaded with its own material, demonstrating multiple primitive mesh types rendered together in one scene.

### All mesh primitive types together

![All mesh primitive types together](web/all-meshes.png)

[▶ web/all-meshes.webm](web/all-meshes.webm)

All mesh primitive types are arranged in a diagonal row — a red cube, red sphere, green cylinder, blue capsule, green plane, orange torus, and purple prism — each correctly rendered as solid 3D geometry with distinct materials.

### CSGBox3D rendered as solid geometry with materials

![CSGBox3D rendered as solid geometry with materials](web/csg-box.png)

[▶ web/csg-box.webm](web/csg-box.webm)

Two CSGBox3D shapes form an L-configuration — an upright light-gray box meeting a flat dark-brown box — rendered as solid lit geometry with materials, confirming CSGBox3D renders as real surfaces rather than placeholders.

### CSGCylinder3D (incl. cone)

![CSGCylinder3D (incl. cone)](web/csg-cylinder.png)

[▶ web/csg-cylinder.webm](web/csg-cylinder.webm)

A tall solid CSGCylinder3D, wider at the top and tapering toward the base, is rendered with a dark olive material and smooth directional shading, demonstrating the cylinder/cone (tapered) form of CSGCylinder3D.

### Metallic PBR StandardMaterial3D

![Metallic PBR StandardMaterial3D](web/material-metallic.png)

[▶ web/material-metallic.webm](web/material-metallic.webm)

A metallic sphere renders dark with a sharp, concentrated specular highlight, demonstrating a high-metallic (metallic=1.0), low-roughness (0.1) PBR StandardMaterial3D reflecting the environment.

### Emissive material

![Emissive material](web/material-emissive.png)

[▶ web/material-emissive.webm](web/material-emissive.webm)

A blue sphere glows uniformly bright across its surface rather than being shaded by light direction, showing the emissive material self-illuminating at energy=2.0.

### WorldEnvironment background + ambient

![WorldEnvironment background + ambient](web/world-environment.png)

[▶ web/world-environment.webm](web/world-environment.webm)

A solid indigo/purple WorldEnvironment background fills the canvas while three pale primitives (including a cube) are evenly ambient-lit with all faces visible, demonstrating the environment background color plus ambient light.

### Camera3D nodes (camera gizmos)

![Camera3D nodes (camera gizmos)](web/multi-camera.png)

[▶ web/multi-camera.webm](web/multi-camera.webm)

The viewport frames a 12-node 'Multi-Camera Test' scene with a red test box and labeled positions for four distinct Camera3D nodes (MainCamera perspective FOV=75, TopCamera looking down FOV=60, SideCamera FOV=70, and OrthoCamera orthographic), demonstrating multiple camera placements in one scene.

### StaticBody3D / Area3D transform groups + AudioStreamPlayer

![StaticBody3D / Area3D transform groups + AudioStreamPlayer](web/physics-bodies.png)

[▶ web/physics-bodies.webm](web/physics-bodies.webm)

The canvas shows a large blue body volume with orange wireframe collision edges under the 'PhysicsRoot' (7 nodes), demonstrating that StaticBody3D/Area3D transform groups are parsed and rendered as positioned geometry in the scene tree.

### Label3D billboarded 3D text

![Label3D billboarded 3D text](web/label3d.png)

[▶ web/label3d.webm](web/label3d.webm)

Three Label3D text nodes are rendered as floating 3D text facing the camera: a magenta 'Y-Axis Billboard', a yellow 'Billboard Enabled', and a white 'Outlined Text' on a dark plate, demonstrating billboarded 3D text with color and outline variations.

### Mixed node hierarchy

![Mixed node hierarchy](web/mixed-nodes.png)

[▶ web/mixed-nodes.webm](web/mixed-nodes.webm)

The viewport frames two lit, shaded gray box meshes arranged at different positions within an 8-node 'Scene' root, demonstrating a mixed node hierarchy of multiple mesh instances rendered together with correct lighting.

## Web vs VS Code

Both the web previewer and the VS Code extension render through the same `@textscene/core` library, so every clip above represents the exact 3D rendering you get inside the VS Code extension too. The VS Code edition adds editor-specific features on top of that shared renderer:

- A custom `.tscn` editor that opens scene files directly in the 3D preview
- A scene-tree Outline view synced with the editor
- Ctrl-click go-to-definition for `res://` resource paths
- Save hot-reload that re-renders on every file save
- Multi-panel layout for working alongside the editor

Existing VS Code screenshots live in [docs/screenshots/vscode/](../screenshots/vscode/).

## Coming soon (re-run to capture)

These features exist in `@textscene/core` but are not yet visible in the running app used for these captures, so they are not shown above. Re-run the capture script once they surface in the previewer:

- The 2D-UI DOM overlay plus the Godot-style 2D/3D viewport toggle
- The collision-shape wireframe toggle
- The 3-column DCC chrome layout
- A dedicated lighting demo. Godot SpotLight3D / OmniLight3D / DirectionalLight3D
  rendering is implemented (the metallic clip's specular highlight and the
  shaded primitives are lit by it), but the current lights-only fixture has no
  geometry to illuminate, so a furnished lit-scene fixture is needed to show it well.

## Regenerate

1. Make sure the preview server is running:

   ```bash
   pnpm --filter @textscene/web-previewer build
   pnpm --filter @textscene/web-previewer preview
   ```

2. Capture each clip by passing the fixture's UI label and the output name:

   ```bash
   node scripts/showcase/run.mjs "<Fixture Label>" "<name>"
   ```

   For example:

   ```bash
   node scripts/showcase/run.mjs "All Primitives" "all-primitives"
   ```

   Or run the whole set via the `feature-showcase` workflow.
