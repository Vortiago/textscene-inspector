---
type: XRFaceModifier3D
category: 3D
status: linter-only
fixture: unit-xr-face-modifier-3d.tscn
# image: unit-xr-face-modifier-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XRFaceModifier3D

XRFaceModifier3D drives a MeshInstance3D's blend shapes from a live XRFaceTracker's Unified
Expressions weights, matched to the mesh's blend shape names. It draws nothing of its own, so
the previewer renders it as a transform-only group (ADR-0008): the target mesh still shows,
at whatever blend-shape values the scene file itself states, not the live tracked ones.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `face_tracker` | `&"/user/face_tracker"` | the XRFaceTracker path polled for blend weights, the documented default |
| `target` | `NodePath("../MeshInstance3D")` | the mesh whose blend shapes get driven |

## Divergences

None visible in this fixture: neither property changes what a static scene draws, since both
drive live per-frame tracking data the previewer never has.

## Linting

<!-- lint:begin XRFaceModifier3D -->
Strict parsing format-checks these `XRFaceModifier3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `face_tracker` | quoted string or &"name" |  |
| `target` | NodePath("path/to/node") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads XRFaceModifier3D through `parseNode3D`, so a malformed
`face_tracker` (an unquoted bare word) or `target` (a bare quoted string instead of a
NodePath literal) is kept as opaque, unparsed text — there is no tracked blend weight to
substitute either way. Strict parsing is where these are read, and there a bad
value is an error, not a lenient default.
