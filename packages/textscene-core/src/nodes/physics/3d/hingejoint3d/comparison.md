---
type: HingeJoint3D
category: 3D
status: linter-only
fixture: unit-hinge-joint-3d.tscn
# image: unit-hinge-joint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# HingeJoint3D

A joint that restricts a body's rotation to one axis relative to another body. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008). Godot shows the hinge only as an editor gizmo.

## Linting

<!-- lint:begin HingeJoint3D -->
Strict parsing format-checks these `HingeJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `angular_limit/bias` | float 0.01-0.99 | warning |
| `angular_limit/enable` | true or false |  |
| `angular_limit/lower` | radians, -180° to 180° | warning |
| `angular_limit/relaxation` | float 0.01-16 | warning |
| `angular_limit/softness` | float 0.01-16 | warning |
| `angular_limit/upper` | radians, -180° to 180° | warning |
| `motor/enable` | true or false |  |
| `motor/max_impulse` | float 0.01-1024 | warning |
| `motor/target_velocity` | float |  |
| `params/bias` | float 0-0.99 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, which reads only `transform` and `visible`. An out-of-range `angular_limit/upper` or a malformed `motor/enable` is dropped from the lenient tree rather than substituted or warned on.
