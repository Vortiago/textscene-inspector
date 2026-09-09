---
type: SliderJoint3D
category: 3D
status: linter-only
fixture: unit-slider-joint-3d.tscn
# image: unit-slider-joint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# SliderJoint3D

A joint that restricts a body's movement to one axis relative to another body. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008). Godot shows the slider only as an editor gizmo.

## Linting

<!-- lint:begin SliderJoint3D -->
Strict parsing format-checks these `SliderJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit/damping` | float 0-16 | warning |
| `angular_limit/lower_angle` | radians, -180° to 180° | warning |
| `angular_limit/restitution` | float 0.01-16 | warning |
| `angular_limit/softness` | float 0.01-16 | warning |
| `angular_limit/upper_angle` | radians, -180° to 180° | warning |
| `angular_motion/damping` | float 0-16 | warning |
| `angular_motion/restitution` | float 0.01-16 | warning |
| `angular_motion/softness` | float 0.01-16 | warning |
| `angular_ortho/damping` | float 0-16 | warning |
| `angular_ortho/restitution` | float 0.01-16 | warning |
| `angular_ortho/softness` | float 0.01-16 | warning |
| `linear_limit/damping` | float 0-16 | warning |
| `linear_limit/lower_distance` | float -1024-1024 | warning |
| `linear_limit/restitution` | float 0.01-16 | warning |
| `linear_limit/softness` | float 0.01-16 | warning |
| `linear_limit/upper_distance` | float -1024-1024 | warning |
| `linear_motion/damping` | float 0-16 | warning |
| `linear_motion/restitution` | float 0.01-16 | warning |
| `linear_motion/softness` | float 0.01-16 | warning |
| `linear_ortho/damping` | float 0-16 | warning |
| `linear_ortho/restitution` | float 0.01-16 | warning |
| `linear_ortho/softness` | float 0.01-16 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, which reads only `transform` and `visible`. An out-of-range `linear_limit/upper_distance` or a malformed `angular_limit/upper_angle` is dropped from the lenient tree rather than substituted or warned on.
