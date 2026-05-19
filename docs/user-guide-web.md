# TextScene Inspector — Web Previewer User Guide

The TextScene Inspector web previewer is a browser-based viewer for Godot `.tscn` scene files. Pick a fixture from the dropdown, the 3D scene renders inline, and a sidebar shows the scene-tree hierarchy and per-node properties. You can orbit the camera (left-drag), zoom (scroll wheel), pan (right-drag or middle-drag), and click a mesh in the viewport to select it.

This guide walks through every user-visible feature against the verification scenarios in `docs/user-flows.md`. Each section captures one flow, embeds the screenshot the verifier took, and is honest about what works today and what does not.

**Source of verification:** the R3F-migration `feat/r3f-migration` branch at commit `17bef1d` (WI-R3F-7b — missing-texture chain, upload UI, fallback labels, and parse-error banner). Dev server runs on `http://localhost:3000/` after `pnpm --filter @textscene/web-previewer dev`.

---

## Opening the app — WEB-01

**Status:** PASS

Start the dev server and open the URL the Vite banner prints (typically `http://localhost:3000/`). The page boots directly to a working canvas — no flag, no setup, no waiting for assets beyond the initial bundle. The default scene `integration-all-primitives.tscn` is selected and rendered, showing a blue capsule, a brown torus, a purple prism on a green floor, with directional lighting baked in. The sidebar on the right shows the scene-tree panel and node-details panel.

![App boots to a working canvas](screenshots/web/web-01-a.png)

You will see one harmless console message about a missing `favicon.ico` and a deprecation note about `THREE.Clock` coming from the bundled three.js — neither affects rendering.

---

## Cycling through fixtures — WEB-02

**Status:** PASS

The **Scene** dropdown lists 70 fixtures grouped into categories (Edge Cases, Examples — Complex Scenes, Integration — Multi-Node, Unit — Primitive Meshes, and so on). Selecting any entry switches the viewport and tree panel to that scene. The verification cycled through the ten MVS-scope unit fixtures listed below and confirmed each renders cleanly:

- `unit-empty-scene.tscn` — empty tree, canvas is the default background, no crash
- `unit-node3d-basic.tscn` — single Node3D root
- `unit-mesh-instance-basic.tscn` — Node3D root + MeshInstance3D child
- `unit-box-mesh.tscn` — see Box screenshot below
- `unit-sphere-mesh.tscn` — see Sphere screenshot below
- `unit-plane-mesh.tscn` — see Plane screenshot below
- `unit-cylinder-mesh.tscn` — see Cylinder screenshot below
- `unit-capsule-mesh.tscn` — see Capsule screenshot below
- `unit-camera-basic.tscn` — Camera3D node + frustum gizmo
- `unit-world-environment-basic.tscn` — see WorldEnvironment section (BOTH-04) below

Each MVS mesh primitive renders with the correct shape:

![Box Mesh](screenshots/web/web-02-a.png)

![Sphere Mesh](screenshots/web/web-02-b.png)

![Plane Mesh](screenshots/web/web-02-c.png)

![Cylinder Mesh](screenshots/web/web-02-d.png)

![Capsule Mesh](screenshots/web/web-02-e.png)

A few unit fixtures (Box, Sphere, Cylinder, Capsule) include floating "Test"-labeled text in the scene — those are Label3D nodes embedded for documentation. They look oversized because the default camera is close to the mesh; orbit out (scroll wheel) to put them in proportion.

---

## Missing-texture meshes — WEB-03

**Status:** PASS (fixed in WI-R3F-7b, commit `17bef1d`)

When you load a scene that references an external texture file the dev server cannot resolve, the affected mesh renders as a magenta-tinted placeholder with a floating label naming the missing path. The label is billboarded toward the camera so it stays readable as you orbit. Other meshes in the scene are unaffected.

![Test Missing Texture — magenta mesh with floating "res://textures/test-upload.png missing" label](screenshots/web/web-03-a.png)

The fixture above (`scenes/fixtures/test-missing-texture.tscn`) references `res://textures/test-upload.png`, intentionally absent from the repo. The placeholder behaviour applies whether the texture is referenced directly by an ExtResource or indirectly through a SubResource StandardMaterial3D's `albedo_texture`. To clear it, upload the missing file via the toolbar control documented in the next section.

---

## Uploading a missing file at runtime — WEB-04

**Status:** PASS (fixed in WI-R3F-7b, commit `17bef1d`)

Open a scene with a missing texture, then drop the correct file into the page later via the **Upload missing files** toolbar control. The dependent mesh re-renders with the new texture; meshes that depend on a different (still-missing) file stay magenta. No page reload, no fixture re-selection.

![Magenta placeholder before upload](screenshots/web/web-04-a.png)

The header shows an "Upload missing files: [Choose Files]" picker. Selecting a PNG (any image renamed to match the missing path's basename — e.g. `test-upload.png` to satisfy `res://textures/test-upload.png`) applies the texture immediately:

![Texture applied after upload — green "Uploaded: test-upload.png" indicator visible in the toolbar](screenshots/web/web-04-b.png)

The toolbar shows a green "Uploaded: &lt;filename&gt;" confirmation listing every late-arrival file you have provided this session. Uploads persist across fixture switches, so the same file applies to any other scene that references it. The dependency-walk uses `nodeDependsOnPath` to limit re-renders to the meshes that actually depend on the new file.

---

## Shared-texture late arrival — WEB-05

**Status:** PASS (fixed in WI-R3F-7b, commit `17bef1d`)

`test-multiple-meshes-shared-texture.tscn` has three meshes: Mesh1 and Mesh2 share a material backed by `res://textures/shared.png`; Mesh3 uses a different material backed by `res://textures/different.png`. Both files are intentionally absent. All three meshes start as magenta placeholders, each with its own "&lt;path&gt; missing" label.

![Three meshes before upload — all magenta with per-mesh missing-path labels](screenshots/web/web-05-a.png)

Upload a real PNG named `shared.png` via the toolbar. Mesh1 and Mesh2 update in the same animation frame; Mesh3 stays magenta because its texture (`different.png`) is still missing.

![After shared.png upload — Mesh1 + Mesh2 textured in lockstep, Mesh3 still magenta](screenshots/web/web-05-b.png)

Two meshes pointing at the same texture path receive the new resource simultaneously through a shared cache — no double load, no perceptible lag between them. The "Uploaded:" toolbar indicator accumulates every late-arrival file you provide.

---

## Click-to-select a mesh — WEB-06

**Status:** PASS (verified on a deviation fixture)

Clicking a mesh in the viewport selects it: the matching row in the scene-tree panel becomes highlighted blue, and the right-hand details panel populates with the node's type, path, mesh sub-resource, material override, position, rotation and scale. Clicking a different node in the tree switches the selection and updates the details panel in the same way.

![Viewport click selects the Box](screenshots/web/web-06-a.png)

![Tree click switches the selection to the Title Label3D](screenshots/web/web-06-b.png)

**Deviation note:** The spec asked for `integration-three-cubes.tscn`, which instances a child scene three times via `instance = ExtResource("...")`. The current build does not render instanced PackedScene children — the tree shows them, but the viewport is empty, so there are no targets to click. Verification used `unit-box-mesh.tscn` instead, which inlines its mesh and renders normally. Click-to-select itself is fully functional; the gap is in PackedScene instancing, which is a separate scope.

---

## Hot-reload preserves camera — WEB-07

**Status:** Architecturally FAIL on web (works in VS Code)

The PRD wants the camera to keep its orbit position when you edit the source `.tscn` file and save. In the web app this is not testable because the web app loads scenes via `fetch('/fixtures/<name>.tscn')` on dropdown change — there is no file-watch subscription. Vite serves `public/fixtures/` as static assets and does not HMR-watch them. The only way to see edited content is to re-select the fixture in the dropdown (or reload the page), and both reset the camera by design.

![Orbited camera before edit](screenshots/web/web-07-a.png)

![After edit + dropdown reselect — box moved, camera reset to default](screenshots/web/web-07-b.png)

The two screenshots above show the box translating from origin to X=3 after the verifier edited the fixture, confirming the parser and renderer handled the new content correctly. The camera angle, however, was reset because re-selecting the fixture counts as a full scene reload.

**Known issue:** PRD US-8 (camera survives content-only hot reload) is meaningful in the VS Code extension, which exposes a `vscode.workspace.onDidChangeWatchedFiles` → `webview.postMessage` flow that updates the existing webview without a full reload. The web app would need a parallel mechanism (a Vite plugin watching `scenes/fixtures/` plus a custom HMR event the app subscribes to, or moving fixtures out of `public/` and into the module graph). Tracked for design decision.

---

## Unsupported node types — WEB-08

**Status:** PASS (fixed in WI-R3F-7b, commit `17bef1d`)

Loading `unit-unsupported-nodes.tscn`, which contains `Area3D` (PhysicsArea), `AnimationPlayer` (AnimPlayer) and `Timer` (GameTimer), shows each unsupported node as a small dark-grey placeholder gizmo with a floating viewport-side label in the format **`<Type>: <Name>`**. The scene tree also tags each unsupported node with a yellow `NOT IMPLEMENTED` indicator next to its type abbreviation.

![Unsupported nodes with placeholder gizmos and "Area3D: PhysicsArea" / "AnimationPlayer: AnimPlayer" labels in the viewport](screenshots/web/web-08-a.png)

The labels are billboarded toward the camera so they stay readable as you orbit. You can identify each placeholder without having to consult the tree panel.

---

## Light and camera gizmos — WEB-09

**Status:** PASS

Light and camera nodes do not produce geometry of their own, so the previewer draws helper wireframes at their transforms so you can see where they sit in the scene.

![Three light gizmos visible — spot cone, omni sphere, directional octahedron](screenshots/web/web-09-a.png)

Loading `integration-lights-all-types.tscn` and zooming out shows all three light helpers:
- **SpotLight3D** — a cone/frustum with the apex at the light's position
- **OmniLight3D** — a large wireframe sphere around the light at its falloff radius
- **DirectionalLight3D** — a small octahedron at the light's position (three.js's standard DirectionalLightHelper)

![Camera frustum gizmo on unit-camera-basic.tscn](screenshots/web/web-09-b.png)

Loading `unit-camera-basic.tscn` shows the Camera3D as a frustum wireframe — orange lines extending from the camera origin outward to define its view volume.

Tip: the default camera is often inside the gizmo geometry for these single-node fixtures, so you may see only line fragments. Scroll out a few clicks to get a comfortable view.

---

## Malformed `.tscn` files — WEB-10

**Status:** PASS (fixed in WI-R3F-7b, commit `17bef1d`)

If you load a fixture with broken syntax (e.g. `edge-malformed-bracket.tscn` with missing closing brackets), a dark-red error banner appears above the viewport area reading "**Parse error:** Parser could not extract any nodes from the content. The file may be malformed." The app stays responsive — dropdown and panels remain interactive. Switching to a well-formed fixture afterwards loads normally, the banner disappears, no leftover state.

![Malformed fixture — red parse-error banner across the top, empty viewport below](screenshots/web/web-10-a.png)

The banner distinguishes a parse failure from a legitimately empty scene (which simply shows "No nodes to display" without the red banner).

---

## Integration scene — BOTH-01

**Status:** PASS

`integration-all-primitives.tscn` is the canonical integration fixture and renders correctly: blue capsule, brown torus, green floor plane and the corner of the purple prism are all visible together. Lighting is non-flat — the torus shows a strong highlight on top with a darker bottom edge, and the capsule has a bright spot on its top hemisphere with a shadow side. The BackWall is offscreen at the default camera angle; orbit to see it.

![integration-all-primitives — capsule, torus, prism, floor with directional light](screenshots/web/both-01-a.png)

This screenshot satisfies WI-R3F-5 acceptance criterion (1) — the integration fixture renders without errors and the scene-tree panel lists all expected children (Root, Floor, Capsule, Torus, Prism, BackWall, DirectionalLight, FillLight).

---

## Every primitive renders — BOTH-02

**Status:** PASS

Cross-reference WEB-02. Each MVS mesh primitive renders with a distinguishable shape and no console errors:

- `unit-box-mesh.tscn` — tan box (`docs/screenshots/web/both-02-a.png`)
- `unit-sphere-mesh.tscn` — maroon sphere (`docs/screenshots/web/both-02-b.png`)
- `unit-plane-mesh.tscn` — green floor plane (`docs/screenshots/web/both-02-c.png`)
- `unit-cylinder-mesh.tscn` — green cylinder (`docs/screenshots/web/both-02-d.png`)
- `unit-capsule-mesh.tscn` — blue capsule (`docs/screenshots/web/both-02-e.png`)

(The screenshots are identical to the WEB-02 captures, just stored under the BOTH-02 file slots.)

---

## Lights illuminate meshes — BOTH-03

**Status:** PASS

Two scenes together prove that lights produce both gizmos AND illumination on neighbouring meshes.

![Three light gizmos visible — spot cone, omni sphere, directional octahedron](screenshots/web/both-03-a.png)

`integration-lights-all-types.tscn` (above): all three light helpers visible at their transforms. Same content as WEB-09-a; the fixture is mesh-free by design.

![Two cubes with directional shading — top faces bright, sides progressively darker](screenshots/web/both-03-b.png)

`integration-mixed-nodes.tscn` (above): two grey cubes show clear directional shading from the scene's DirectionalLight3D — top faces brightest, side faces mid-grey, bottom-side darker. (This fixture only has one light, not the multi-light setup the spec hoped for, so the "colored highlights from the spot light's tint" sub-claim is not testable on this scene. The underlying "lights illuminate meshes" requirement passes.)

---

## WorldEnvironment changes atmosphere — BOTH-04

**Status:** PASS

A `WorldEnvironment` node controls the rendered background and ambient atmosphere. Two fixtures with different WorldEnvironment configurations produce visibly different backgrounds, confirming the node drives the rendered state rather than a hard-coded default.

![World Environment Basic — deep blue-purple background, pinkish cubes](screenshots/web/both-04-a.png)

`unit-world-environment-basic.tscn` (above): deep blue-purple background, two pinkish cube meshes.

![World Environment No Fog — light sky-blue background, yellow spheres](screenshots/web/both-04-b.png)

`unit-world-environment-no-fog.tscn` (above): light sky-blue background, two yellow/olive spheres. The visible colour difference is the spec's confirmation that the WorldEnvironment node is plumbed through to the renderer.

---

## Known limitations (triage list)

After the WI-R3F-7b fixes (commit `17bef1d`), all five missing-resource and fallback-label gaps from the v1 verification now pass. The remaining outstanding items are below.

1. **No content-only hot reload on web.** Editing a scene file in the source tree does not propagate to the open page without a dropdown re-selection or full page reload, both of which reset the camera. PRD US-8 (camera survives content-only hot reload) is unreachable on web. The VS Code extension implements the equivalent via `onDidChangeWatchedFiles`; the web app would need a parallel mechanism (a Vite plugin watching `scenes/fixtures/` plus a custom HMR event the app subscribes to, or moving fixtures out of `public/` and into the module graph). (Flow affected: WEB-07.)

2. **PackedScene instances do not render.** Fixtures using `instance = ExtResource("...")` to mount a child scene (e.g. `integration-three-cubes.tscn`) show the parent Node3D entries in the tree but the inner scene's meshes do not appear in the viewport. The scene-tree details panel correctly shows the `📦 External:` indicator on each parent. This is a separate scope from the MVS port and does not block the BOTH flows, since `integration-all-primitives.tscn` uses inline meshes. (Flow affected: WEB-06 — verifier worked around with `unit-box-mesh.tscn`.)

3. **Sidebar text during a parse error reads "Loading scene…".** When the red parse-error banner is visible at the top, the sidebar still says "Loading scene…" instead of mirroring the error state. The primary error indicator (the red banner) is clear, but this is a small UX polish opportunity. (Flow affected: WEB-10.)
