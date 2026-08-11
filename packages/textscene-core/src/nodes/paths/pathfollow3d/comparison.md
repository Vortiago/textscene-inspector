---
type: PathFollow3D
category: 3D
fixture: unit-pathfollow-3d.tscn
image: unit-pathfollow-3d
renders_as: a curve-positioned transform group
---

# PathFollow3D

PathFollow3D positions its children a set distance along its parent Path3D's
curve. The previewer samples the curve and drives a transform group to that point;
here it carries an orange box that lands at the arc-length midpoint of the
U-shaped track, one node in the row of blue marker boxes that trace the curve. Its
editor follow-point gizmo is selection-gated (ADR-0018), so a plain capture shows
only the box the follower carries.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `progress` | `3.0528675` | absolute distance in metres along the curve; at instantiation Godot honours this value, placing the follower at the arc-length midpoint — the bottom of the U at `(0, 0, -1.4)` |
| `transform` | translation `(0, 0, -1.4)` | normally overridden by `progress`, but authored to the same midpoint so any resolution path lands the box identically |

`progress_ratio` is deliberately absent. It is the one position key a scene file
cannot carry: Godot binds the parent Path3D on enter-tree, after a node's
properties are applied, so its setter refuses every stored ratio.

## Divergences

The orange follower box lands at the bottom of the U at `(0, 0, -1.4)` in both
images, beside the same blue marker — placement agrees. Shadows differ in edge
softness: the reference box and markers cast crisp, dark footprints in Godot, while
the previewer's directional light applies softer, more diffuse shadow filtering —
most visible under the large reference box. This is a global shadow difference, not
PathFollow3D behaviour.

## Linting

<!-- lint:begin PathFollow3D -->
Strict parsing format-checks these `PathFollow3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `cubic_interp` | true or false |
| `h_offset` | float |
| `loop` | true or false |
| `progress` | float |
| `progress_ratio` | float |
| `rotation_mode` | enum 0-4 (NONE/Y/XY/XYZ/ORIENTED) |
| `tilt_enabled` | true or false |
| `use_model_front` | true or false |
| `v_offset` | float |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-pathfollow3d` | `pathfollow3d-no-parent` | warning |
|  | `pathfollow3d-invalid-parent` | warning |
|  | `pathfollow3d-negative-progress` | warning |
|  | `pathfollow3d-progress-ratio-ignored` | error |
|  | `pathfollow3d-oriented-mode-requires-up-vector` | warning |
<!-- lint:end -->

h_offset and v_offset default to 0, and cubic_interp/loop/tilt_enabled default
to true, warning and falling back to those defaults only when the property is
present but unparseable. rotation_mode uses `intOr` rather than an enum-aware
reader: strict rejects any value outside 0-4, but the lenient parser accepts
any parseable int (`rotation_mode="99"` survives untouched) and falls back to
`XYZ` (3) only when the value isn't a number at all. use_model_front skips the
shared bool reader entirely: it's a raw `=== 'true'` comparison, so any
non-"true" string (including `"1"` or `"TRUE"`) silently becomes false with no
warning, unlike the sibling boolean flags. progress and progress_ratio stay
optional: left undefined when absent, but warned-and-defaulted to 0 when
present yet unparseable.
