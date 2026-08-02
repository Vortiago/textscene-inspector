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

A physics joint that restricts a 3D body's rotation to a single axis relative to another body; it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008), and Godot itself shows the hinge only as an editor-only gizmo that never appears in a runtime capture either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `params/bias` | `0.3` | none: how fast the two bodies get pulled back together; not drawn |
| `angular_limit/enable` | `true` | none: turns on the `angular_limit/lower`/`upper` clamp; not drawn |
| `angular_limit/upper` | `1.0471975` (60° in radians) | none: the maximum rotation while the limit is enabled; not drawn |
| `angular_limit/lower` | `-1.0471975` (-60° in radians) | none: the minimum rotation while the limit is enabled; not drawn |
| `angular_limit/bias` | `0.3` | none: how fast rotation across the perpendicular axis is corrected; not drawn |
| `angular_limit/softness` | `0.9` | none: deprecated compatibility field, never set by the engine itself; not drawn |
| `angular_limit/relaxation` | `1.0` | none: how strongly rotation past the limit is slowed; not drawn |
| `motor/enable` | `true` | none: turns on the motor that drives the hinge; not drawn |
| `motor/target_velocity` | `3.0` | none: the motor's target angular speed; not drawn |
| `motor/max_impulse` | `1.0` | none: the motor's maximum acceleration; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin HingeJoint3D -->
Strict parsing format-checks these `HingeJoint3D` properties, plus 4 inherited from Joint3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_limit/bias` | float 0.01-0.99 |
| `angular_limit/enable` | true or false |
| `angular_limit/lower` | radians, -180° to 180° |
| `angular_limit/relaxation` | float 0.01-16 |
| `angular_limit/softness` | float 0.01-16 |
| `angular_limit/upper` | radians, -180° to 180° |
| `motor/enable` | true or false |
| `motor/max_impulse` | float 0.01-1024 |
| `motor/target_velocity` | float |
| `params/bias` | float 0-0.99 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, which reads only `transform` and
`visible`, so an out-of-range `angular_limit/upper` or a malformed `motor/enable`
is silently dropped from the lenient tree rather than substituted or warned on:
the parsed node's `properties` never carries these keys at all, valid or not,
consistent with rendering as a transform-only group (ADR-0008).
