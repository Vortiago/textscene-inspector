# TextScene Inspector: Web Previewer User Guide

The TextScene Inspector web previewer shows Godot `.tscn` scene files in a browser. Open your own `.tscn` from disk, or pick a fixture from the scene palette (Ctrl/Cmd+K). The 3D scene renders inline, and the Split Dock on the right shows the scene-tree hierarchy and the properties of each node. The viewport navigates like Godot's own 3D editor (see below), and a click on a mesh selects it.

Each section below covers one verification scenario from `docs/user-flows.md`, with the screenshot of that flow, and states what works and what does not.

`pnpm --filter @textscene/web-previewer dev` starts the dev server on `http://localhost:3000/`. Some screenshots predate the Split Dock shell (ADR-0007) and the scene palette. The text describes the current behaviour.

## Viewport navigation

The 3D viewport uses Godot's own editor navigation. The viewport shows a summary pill: click
it, or press **?**, to open the full list for the device you are on (ADR-0029).

**Mouse**

| Input | Action |
| --- | --- |
| Left-click | Select |
| Middle-drag | Orbit |
| Shift + middle-drag | Pan |
| Ctrl + middle-drag, or the wheel | Zoom |
| Shift + wheel | Pan |
| Alt + left-drag / Alt + Shift + left-drag | Orbit / pan, for mice and trackpads without a middle button |
| Right-drag | Freelook: turn the camera in place |

**Trackpad**

| Input | Action |
| --- | --- |
| Two-finger scroll | Zoom |
| Shift + two-finger scroll | Pan |
| Pinch | Zoom |

A browser reports a two-finger scroll and a mouse wheel as the same event. The unmodified
scroll therefore keeps the wheel's meaning (zoom), and Shift gives a trackpad its pan. Ctrl + wheel
zooms the viewport, not the page, because a pinch arrives as that event.

Zoom goes **toward the pointer**, so what is under the cursor stays under it. Godot's editor
zooms toward the middle of the scene instead (ADR-0029). If zoom stops before you get close
enough, select the node and press **F**. Framing on it moves the pivot to the node and the near
plane in, which removes the limit.

**Touch and stylus** (tablets have no Godot equivalent, so these follow the usual 3D-viewer
conventions. A stylus behaves as one finger does.)

| Input | Action |
| --- | --- |
| Tap | Select |
| One-finger drag | Orbit |
| Two-finger drag | Pan |
| Pinch | Zoom |

**Keyboard**

| Input | Action |
| --- | --- |
| W A S D Q E while right-dragging | Fly (Shift sprints) |
| Numpad 1 / 3 / 7 | Front / right / top view; Ctrl for the opposite face |
| Numpad 5 | Perspective ⇄ orthographic |
| F | Frame the selected node, or the whole scene when nothing is selected |
| ? | Show every viewport control |

A plain left-drag does nothing: left-click selects, as it does in Godot.
There is no damping: the camera stops when you release.

The 2D viewport pans on a drag (one finger or two) and zooms on the wheel or a pinch, anchored
to the pointer, with a −/+/Fit HUD along the bottom.

## Opening the app: WEB-01

**Status:** PASS

Start the dev server and open the URL the Vite banner prints (typically `http://localhost:3000/`). The page opens on a working canvas, with no flag and no setup.

- On a first visit the default scene is `unit-plane-mesh.tscn`: a single PlaneMesh with zero external resources, so the first paint shows no missing-file warnings.
- On a later visit the app restores the last scene you had open, from `localStorage`.
- A `?fixture=<file>` query parameter opens a specific scene, for a shared link or a scripted capture.
- `&camera=<node path>` (for example `?fixture=integration-material-features.tscn&camera=Root/Camera3D`) opens the view through a scene's own Camera3D instead of the free-orbit editor camera. The path is the one the Cameras panel lists. An unknown path falls back to free orbit. The app reads it once at open and does not write it back into the URL.

The Split Dock on the right shows the scene-tree panel on top and the tabbed detail panel (Inspector / Resources / Cameras) below.

![App boots to a working canvas](screenshots/web/web-01-a.png)

The console shows one message about a missing `favicon.ico` and a deprecation note about `THREE.Clock` from the bundled three.js. Neither affects rendering.

## Cycling through fixtures: WEB-02

**Status:** PASS

The toolbar shows a **scene chip** that names the current scene. Click it, or press **Ctrl/Cmd+K**, to open a searchable command palette. Its first action is **"Open a `.tscn` from disk…"**. Below that it lists the bundled fixtures from the generated `apps/textscene-web/src/fixtures.ts` manifest, grouped into categories (Edge Cases, Examples: Complex Scenes, Integration: Multi-Node, Unit: Primitive Meshes, and so on). Type to filter, use the arrow keys and Enter to pick, and Escape to close. The viewport and tree panel then switch to the selected scene. Each of these unit fixtures renders without errors:

- `unit-empty-scene.tscn`: empty tree, the canvas shows the default background, no crash
- `unit-node3d-basic.tscn`: single Node3D root
- `unit-mesh-instance-basic.tscn`: Node3D root and a MeshInstance3D child
- `unit-box-mesh.tscn`: see the Box screenshot below
- `unit-sphere-mesh.tscn`: see the Sphere screenshot below
- `unit-plane-mesh.tscn`: see the Plane screenshot below
- `unit-cylinder-mesh.tscn`: see the Cylinder screenshot below
- `unit-capsule-mesh.tscn`: see the Capsule screenshot below
- `unit-camera-basic.tscn`: Camera3D node and frustum gizmo
- `unit-world-environment-basic.tscn`: see the WorldEnvironment section (BOTH-04) below

Each mesh primitive renders with the correct shape:

![Box Mesh](screenshots/web/web-02-a.png)

![Sphere Mesh](screenshots/web/web-02-b.png)

![Plane Mesh](screenshots/web/web-02-c.png)

![Cylinder Mesh](screenshots/web/web-02-d.png)

![Capsule Mesh](screenshots/web/web-02-e.png)

Some unit fixtures (Box, Sphere, Cylinder, Capsule) contain Label3D nodes with "Test" text. They look large because the default camera is close to the mesh. Scroll out to see them in proportion.

## Missing-texture meshes: WEB-03

**Status:** PASS

When a scene references an external texture file that the app cannot resolve, the affected mesh renders with a magenta placeholder material. Other meshes in the scene are unaffected. The **Resources** tab lists each missing path. The viewport shows no text label for it.

![Test Missing Texture: magenta mesh with floating "res://textures/test-upload.png missing" label](screenshots/web/web-03-a.png)

The fixture above (`scenes/fixtures/test-missing-texture.tscn`) references `res://textures/test-upload.png`, which is absent from the repo on purpose. The screenshot predates the Resources tab and still shows the old floating label. The placeholder applies when an ExtResource references the texture directly, and when a SubResource StandardMaterial3D references it through `albedo_texture`. To clear it, upload the missing file in the **Resources** tab (next section).

## Uploading a missing file at runtime: WEB-04

**Status:** PASS

Open a scene with a missing texture, then give the file later in the Split Dock's **Resources** tab. The dependent mesh renders again with the new texture. A mesh that depends on a different file that is still missing stays magenta. You do not reload the page or select the fixture again.

![Magenta placeholder before upload](screenshots/web/web-04-a.png)

The Resources tab's `MissingResourcesPanel` lists one row for each missing `res://` path. Each row has a ⚠ icon and its own file input. There is no global picker that guesses file names. When you choose a file for a row (any image, for example a PNG for `res://textures/test-upload.png`), the texture applies immediately:

![Texture applied after upload](screenshots/web/web-04-b.png)

After the upload, the row changes to a ✓ "uploaded" state with a **Remove** button. **Remove** sets the path back to missing, and the dependent mesh goes back to the magenta placeholder. Uploads persist when you switch fixtures, so the same file applies to any other scene that references it. Only the meshes that depend on the new file render again. The showcase clip [`docs/showcase/web/missing-upload.webm`](showcase/web/missing-upload.webm) records this flow from start to end.

## Shared-texture late arrival: WEB-05

**Status:** PASS

`test-multiple-meshes-shared-texture.tscn` has three meshes. Mesh1 and Mesh2 share a material backed by `res://textures/shared.png`. Mesh3 uses a different material backed by `res://textures/different.png`. Both files are absent on purpose. All three meshes start as magenta placeholders, and the Resources tab lists both paths as missing (⚠).

![Three meshes before upload: all magenta, with per-mesh missing-path labels](screenshots/web/web-05-a.png)

Upload a real PNG on the `res://textures/shared.png` row in the Resources tab. Mesh1 and Mesh2 update in the same animation frame. Mesh3 stays magenta, because its texture (`different.png`) is still missing.

![After shared.png upload: Mesh1 and Mesh2 textured together, Mesh3 still magenta](screenshots/web/web-05-b.png)

Two meshes that point at the same texture path get the new resource at the same time through a shared cache, with no second load. The Resources tab lists every uploaded path with a ✓, so you can see, and remove, the files you gave in this session.

## Click-to-select a mesh: WEB-06

**Status:** PASS

A click on a mesh in the viewport selects it. The matching row in the scene-tree panel turns blue, and the Inspector tab shows the node's type, path, mesh sub-resource, material override, position, rotation and scale. A click on a different node in the tree changes the selection and updates the Inspector tab in the same way.

![Viewport click selects the Box](screenshots/web/web-06-a.png)

![Tree click switches the selection to the Title Label3D](screenshots/web/web-06-b.png)

The screenshots use `unit-box-mesh.tscn`. The spec names `integration-three-cubes.tscn`, which instances a child scene three times through `instance = ExtResource("...")`. That fixture also works: `NodeDispatcher` resolves the `instance = ExtResource(...)` reference and mounts the external scene's subtree under the instance transform (see `NodeDispatcher.instance.test.tsx`).

## Hot-reload preserves camera: WEB-07

**Status:** FAIL on web by design (works in VS Code)

The spec wants the camera to keep its orbit position when you edit and save the source `.tscn` file. The web app cannot do this: it loads a scene with `fetch('/fixtures/<name>.tscn')` when you select it, and has no file-watch subscription. Vite serves `public/fixtures/` as static assets and does not HMR-watch them. To see edited content, select the scene again from the palette or reload the page. Both reset the camera.

![Orbited camera before edit](screenshots/web/web-07-a.png)

![After edit and reselect: box moved, camera reset to default](screenshots/web/web-07-b.png)

The two screenshots show the box moved from the origin to X=3 after an edit to the fixture, so the parser and renderer read the new content. The camera angle is reset, because selecting the fixture again is a full scene reload.

See [Known limitations](#known-limitations-triage-list) for what the web app would need.

## Unsupported node types: WEB-08

**Status:** PASS

`unit-unsupported-nodes.tscn` contains `Area3D` (PhysicsArea), `AnimationPlayer` (AnimPlayer) and `Timer` (GameTimer). All three types have registered components now:

- **Area3D** and **Timer** render as transform-only groups (ADR-0008). A physics body positions its children and draws nothing itself (ADR-0005).
- **AnimationPlayer** has its own slice, and plays its clips through the selection-driven Animation transport (ADR-0011/0012).

A type with no registration goes through `<GenericNodeFallback>`, an invisible transform-only group with no placeholder gizmo (ADR-0008). A type registered as `pending`, such as `GPUParticles2D` in `example-dodge-player.tscn`, renders through its base type. The scene tree tags both with a yellow **`Not Implemented`** chip next to the type abbreviation. You find an unsupported type through the tree, and it does not clutter the viewport.

![unit-unsupported-nodes.tscn, in a screenshot that predates the Area3D, AnimationPlayer and Timer registrations and the gizmo-free fallback](screenshots/web/web-08-a.png)

The screenshot is out of date: it shows an older fallback that drew a placeholder gizmo with a floating `<Type>: <Name>` label.

## Light and camera gizmos: WEB-09

**Status:** PASS

Light and camera nodes have no geometry of their own, so the previewer draws helper wireframes at their transforms to show where they are in the scene.

![Three light gizmos visible: spot cone, omni sphere, directional octahedron](screenshots/web/web-09-a.png)

Load `integration-lights-all-types.tscn` and zoom out to see all three light helpers:
- **SpotLight3D**: a cone with the apex at the light's position
- **OmniLight3D**: a large wireframe sphere around the light at its falloff radius
- **DirectionalLight3D**: a small octahedron at the light's position (three.js's standard DirectionalLightHelper)

![Camera frustum gizmo on unit-camera-basic.tscn](screenshots/web/web-09-b.png)

`unit-camera-basic.tscn` shows the Camera3D as a frustum wireframe: orange lines from the camera origin outward that show its view volume.

Tip: in these single-node fixtures the default camera is often inside the gizmo geometry, so you may see only parts of lines. Scroll out a few clicks.

## Malformed `.tscn` files: WEB-10

**Status:** PASS

When you load a fixture with broken syntax (for example `edge-malformed-bracket.tscn`, with missing closing brackets), a dark-red error banner appears above the viewport. It reads "**Parse error:** Parser could not extract any nodes from the content. The file may be malformed." The app stays responsive, and the scene picker and panels still work. While the banner shows, the tree pane shows an empty state that says no scene is loaded and asks you to fix the parse error, instead of a loading indicator. When you then switch to a well-formed fixture, it loads normally, the banner disappears and no state is left over.

![Malformed fixture: red parse-error banner across the top, empty viewport below](screenshots/web/web-10-a.png)

A scene that is empty but valid shows "No nodes to display" and no red banner.

## Integration scene: BOTH-01

**Status:** PASS

`integration-all-primitives.tscn` is the integration fixture, and it renders correctly: the blue capsule, the brown torus, the green floor plane and the corner of the purple prism are all visible together. The lighting is not flat. The torus has a strong highlight on top and a darker bottom edge, and the capsule has a bright spot on its top hemisphere and a shadow side. The BackWall is out of view at the default camera angle. Orbit to see it.

![integration-all-primitives: capsule, torus, prism, floor with directional light](screenshots/web/both-01-a.png)

The fixture renders without errors, and the scene-tree panel lists all expected children (Root, Floor, Capsule, Torus, Prism, BackWall, DirectionalLight, FillLight).

## Every primitive renders: BOTH-02

**Status:** PASS

See also WEB-02. Each mesh primitive renders with a distinct shape and no console errors:

- `unit-box-mesh.tscn`: tan box (`docs/screenshots/web/both-02-a.png`)
- `unit-sphere-mesh.tscn`: maroon sphere (`docs/screenshots/web/both-02-b.png`)
- `unit-plane-mesh.tscn`: green floor plane (`docs/screenshots/web/both-02-c.png`)
- `unit-cylinder-mesh.tscn`: green cylinder (`docs/screenshots/web/both-02-d.png`)
- `unit-capsule-mesh.tscn`: blue capsule (`docs/screenshots/web/both-02-e.png`)

These screenshots are the WEB-02 captures, stored under the BOTH-02 file names.

## Lights illuminate meshes: BOTH-03

**Status:** PASS

Two scenes together show that lights produce both gizmos and illumination on the meshes near them.

![Three light gizmos visible: spot cone, omni sphere, directional octahedron](screenshots/web/both-03-a.png)

`integration-lights-all-types.tscn` (above): all three light helpers at their transforms. This is the same content as WEB-09-a. The fixture has no meshes by design.

![Two cubes with directional shading: top faces bright, sides darker](screenshots/web/both-03-b.png)

`integration-mixed-nodes.tscn` (above): two grey cubes show directional shading from the scene's DirectionalLight3D. The top faces are brightest, the side faces mid-grey and the lower sides darker. This fixture has one light, so it cannot test the spec's "colored highlights from the spot light's tint" claim. The "lights illuminate meshes" requirement passes.

## WorldEnvironment changes atmosphere: BOTH-04

**Status:** PASS

A `WorldEnvironment` node controls the rendered background and the ambient atmosphere. Two fixtures with different WorldEnvironment configurations give different backgrounds, so the node drives the rendered state and no hard-coded default does.

![World Environment Basic: deep blue-purple background, pinkish cubes](screenshots/web/both-04-a.png)

`unit-world-environment-basic.tscn` (above): a deep blue-purple background and two pinkish cube meshes.

![World Environment No Fog: light sky-blue background, yellow spheres](screenshots/web/both-04-b.png)

`unit-world-environment-no-fog.tscn` (above): a light sky-blue background and two yellow-olive spheres. The colour difference shows that the renderer reads the WorldEnvironment node.

## Known limitations (triage list)

1. **No content-only hot reload on web.** An edit to a scene file in the source tree reaches the open page only when you select the scene again from the palette or reload the page. Both reset the camera, so PRD US-8 (the camera survives a content-only reload) cannot pass on web. The VS Code extension does this with `onDidSaveTextDocument` and a `FileSystemWatcher` for dependent resources, which send a `webview.postMessage` that updates the open webview. The web app would need its own mechanism: a Vite plugin that watches `scenes/fixtures/` with a custom HMR event the app subscribes to, or fixtures moved out of `public/` and into the module graph. (Flow affected: WEB-07.)
