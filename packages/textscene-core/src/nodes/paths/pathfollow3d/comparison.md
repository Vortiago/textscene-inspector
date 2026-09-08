---
type: PathFollow3D
category: 3D
status: unreviewed
fixture: unit-pathfollow-3d.tscn
image: unit-pathfollow-3d
renders_as: a curve-positioned transform group
---

# PathFollow3D

Positions its children a set distance along its parent Path3D's curve. The previewer samples the curve and drives a transform group to that point, so the orange box lands at the bottom of the U in both frames.

## Linting

<!-- lint:begin PathFollow3D -->
Strict parsing format-checks these `PathFollow3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `cubic_interp` | true or false |  |
| `h_offset` | float |  |
| `loop` | true or false |  |
| `progress` | float |  |
| `progress_ratio` | float |  |
| `rotation_mode` | enum 0-4 (NONE/Y/XY/XYZ/ORIENTED) | warning |
| `tilt_enabled` | true or false |  |
| `use_model_front` | true or false |  |
| `v_offset` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-pathfollow3d` | `pathfollow3d-no-parent` | warning |
|  | `pathfollow3d-invalid-parent` | warning |
|  | `pathfollow3d-negative-progress` | info |
|  | `pathfollow3d-progress-ratio-ignored` | error |
|  | `pathfollow3d-oriented-mode-requires-up-vector` | warning |
<!-- lint:end -->

`h_offset` and `v_offset` default to 0, and `cubic_interp`, `loop` and `tilt_enabled` default to true, with a warning when present but unparseable. `rotation_mode` reads through `intOr`, so `99` survives and only a non-number falls back to `XYZ` (3). `progress` and `progress_ratio` stay undefined when absent.

## Known limitations

- **Editor only** The follow-point gizmo draws only for the selected node.
