---
type: XRCamera3D
category: 3D
status: unreviewed
fixture: unit-xr-camera-3d.tscn
# image: unit-xr-camera-3d
visual: false
renders_as: a selection-gated frustum gizmo, as Camera3D
---

# XRCamera3D

The headset's eye, which XRServer drives from tracking data at runtime. It is a Camera3D and the previewer treats it as one: the same selection-gated frustum gizmo (ADR-0018), from the same component. `visual: false` because that gizmo is selection-gated, so a plain capture has nothing to pair.

## Properties exercised

XRCamera3D declares no properties of its own (`xr_nodes.cpp` has no `XRCamera3D::_bind_methods` at all); the fixture exercises the inherited Node3D key below. The fixture places the camera at the scene root with no parent, so its own `valid-xrcamera3d-parent` rule (below) stays quiet.

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | inherited from Node3D; positions the (invisible) camera, no visible effect |

## Divergences

This previewer's Cameras panel matches the node type `Camera3D` exactly (`r3f/components/TscnPreviewShell/CamerasPanel.tsx:28,39`), so an XRCamera3D is never offered as a preview camera even though Godot treats it as a full camera. Godot's second XRCamera3D configuration warning — an OFF `physics_interpolation_mode` while FTI is project-enabled — is not modelled here: it depends on `SceneTree::is_fti_enabled_in_project()`, a project setting no `.tscn` carries, so this linter has nothing to check it against. There is otherwise no runtime output to compare — the node draws nothing in either Godot or here, by design.

## Linting

<!-- lint:begin XRCamera3D -->
Strict parsing format-checks the inherited set (15 inherited from Camera3D, 17 inherited from Node3D, 10 inherited from Node); `XRCamera3D` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-camera3d-properties` (type-family match) | `camera3d-invalid-clipping-planes` | error |
| `valid-xrcamera3d-parent` | `xrcamera3d-parent-not-xrorigin3d` | warning |
<!-- lint:end -->

XRCamera3D has no `linterParser.ts` of its own, so strict parsing falls back to
whatever the Node3D/Camera3D base validates. A malformed inherited `transform`
is a strict-parser error, while the lenient parser's `parseNode3D` keeps rendering
with the identity transform rather than reporting anything. The `valid-xrcamera3d-parent`
semantic rule is advisory only (a warning): a camera outside an XROrigin3D still
loads and renders exactly as one inside it would.
