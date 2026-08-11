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

A physics joint that restricts a 3D body's movement to a single axis relative to another body; it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008), and Godot itself shows the slider only as an editor-only gizmo that never appears in a runtime capture either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `linear_limit/upper_distance` | `1.0` | none: the maximum pivot separation along the slider axis before damping; not drawn |
| `linear_limit/lower_distance` | `-1.0` | none: the minimum pivot separation along the slider axis before damping; not drawn |
| `linear_limit/softness` | `1.0` | none: how much slower movement gets once the linear limit is surpassed; not drawn |
| `linear_limit/restitution` | `0.7` | none: how much velocity survives once the linear limit is surpassed; not drawn |
| `linear_limit/damping` | `1.0` | none: how strongly movement is damped once the linear limit is surpassed; not drawn |
| `linear_motion/softness` | `1.0` | none: how much slower movement is inside the slider limits; not drawn |
| `linear_motion/restitution` | `0.7` | none: how much velocity survives inside the slider limits; not drawn |
| `linear_motion/damping` | `0.0` | none: how strongly movement is damped inside the slider limits; not drawn |
| `linear_ortho/softness` | `1.0` | none: how much slower movement across axes orthogonal to the slider is; not drawn |
| `linear_ortho/restitution` | `0.7` | none: how much velocity survives movement across orthogonal axes; not drawn |
| `linear_ortho/damping` | `1.0` | none: how strongly movement across orthogonal axes is damped; not drawn |
| `angular_limit/upper_angle` | `0.5235988` (30° in radians) | none: the maximum rotation in the slider; not drawn |
| `angular_limit/lower_angle` | `-0.5235988` (-30° in radians) | none: the minimum rotation in the slider; not drawn |
| `angular_limit/softness` | `1.0` | none: how much slower rotation gets once the angular limit is surpassed; not drawn |
| `angular_limit/restitution` | `0.7` | none: how much rotational velocity survives once the angular limit is surpassed; not drawn |
| `angular_limit/damping` | `0.0` | none: how strongly rotation is damped once the angular limit is surpassed; not drawn |
| `angular_motion/softness` | `1.0` | none: how much slower rotation is inside the angular limits; not drawn |
| `angular_motion/restitution` | `0.7` | none: how much rotational velocity survives inside the angular limits; not drawn |
| `angular_motion/damping` | `1.0` | none: how strongly rotation is damped inside the angular limits; not drawn |
| `angular_ortho/softness` | `1.0` | none: how much slower rotation across axes orthogonal to the slider is; not drawn |
| `angular_ortho/restitution` | `0.7` | none: how much rotational velocity survives across orthogonal axes; not drawn |
| `angular_ortho/damping` | `1.0` | none: how strongly rotation across orthogonal axes is damped; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SliderJoint3D -->
Strict parsing format-checks these `SliderJoint3D` properties, plus 4 inherited from Joint3D, 17 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_limit/damping` | float 0-16 |
| `angular_limit/lower_angle` | radians, -180° to 180° |
| `angular_limit/restitution` | float 0.01-16 |
| `angular_limit/softness` | float 0.01-16 |
| `angular_limit/upper_angle` | radians, -180° to 180° |
| `angular_motion/damping` | float 0-16 |
| `angular_motion/restitution` | float 0.01-16 |
| `angular_motion/softness` | float 0.01-16 |
| `angular_ortho/damping` | float 0-16 |
| `angular_ortho/restitution` | float 0.01-16 |
| `angular_ortho/softness` | float 0.01-16 |
| `linear_limit/damping` | float 0-16 |
| `linear_limit/lower_distance` | float -1024-1024 |
| `linear_limit/restitution` | float 0.01-16 |
| `linear_limit/softness` | float 0.01-16 |
| `linear_limit/upper_distance` | float -1024-1024 |
| `linear_motion/damping` | float 0-16 |
| `linear_motion/restitution` | float 0.01-16 |
| `linear_motion/softness` | float 0.01-16 |
| `linear_ortho/damping` | float 0-16 |
| `linear_ortho/restitution` | float 0.01-16 |
| `linear_ortho/softness` | float 0.01-16 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, which reads only `transform` and
`visible`, so an out-of-range `linear_limit/upper_distance` or a malformed
`angular_limit/upper_angle` is silently dropped from the lenient tree rather
than substituted or warned on: the parsed node's `properties` never carries
these keys at all, valid or not, consistent with rendering as a transform-only
group (ADR-0008).
