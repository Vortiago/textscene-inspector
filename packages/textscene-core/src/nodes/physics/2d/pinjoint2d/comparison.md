---
type: PinJoint2D
category: 2D
status: linter-only
fixture: unit-pin-joint-2d.tscn
# image: unit-pin-joint-2d
visual: false
renders_as: nothing (a transform-only group)
---

# PinJoint2D

This node attaches two 2D physics bodies at a single point, allowing them to freely rotate. It draws nothing at runtime, since Godot shows joints only as an editor gizmo, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `softness` | `4.5` | how much the pinned bond can flex; not drawn |
| `angular_limit_enabled` | `true` | enables the angular rotation limit; not drawn |
| `angular_limit_lower` | `-0.5` | minimum rotation in radians; not drawn |
| `angular_limit_upper` | `0.5` | maximum rotation in radians; not drawn |
| `motor_enabled` | `true` | enables the motor that turns the pin; not drawn |
| `motor_target_velocity` | `50.0` | motor target speed in radians per second; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin PinJoint2D -->
Strict parsing format-checks these `PinJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 15 inherited from CanvasItem. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `angular_limit_enabled` | true or false |
| `angular_limit_lower` | float -3.1416926535897933-3.1416926535897933 |
| `angular_limit_upper` | float -3.1416926535897933-3.1416926535897933 |
| `motor_enabled` | true or false |
| `motor_target_velocity` | float |
| `softness` | float 0-16 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-joint` (type-family match) | `joint2d-not-connected` | warning |
|  | `joint2d-same-body` | warning |
|  | `joint3d-not-connected` | warning |
|  | `joint3d-same-body` | warning |
<!-- lint:end -->

PinJoint2D has no parser.ts: it reuses parseNode2D directly (index.ts), so its own
properties never reach the lenient parser. A bad value is not substituted or
defaulted, it is simply never read, and only the strict parser reports it.
