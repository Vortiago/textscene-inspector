---
type: GrooveJoint2D
category: 2D
status: linter-only
fixture: unit-groove-joint-2d.tscn
# image: unit-groove-joint-2d
visual: false
renders_as: nothing (a transform-only group; the groove is an editor gizmo)
---

# GrooveJoint2D

GrooveJoint2D restricts body B to sliding along a fixed local-Y axis from the joint's origin; it draws nothing of its own at runtime, so the previewer renders it as a transform-only group (ADR-0008) — Godot itself only draws the groove as a debug line while the editor or the runtime "Visible Collision Shapes" flag is on (`groove_joint_2d.cpp`'s `NOTIFICATION_DRAW` guard), so a plain gameplay capture shows nothing either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `length` | `80.0` | groove's extent along its local Y axis — no visible mark |
| `initial_offset` | `15.0` | body B's initial anchor position along the groove — no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin GrooveJoint2D -->
Strict parsing format-checks these `GrooveJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `initial_offset` | float 1-65535 |
| `length` | float 1-65535 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

GrooveJoint2D has no `parser.ts` of its own: it registers `parseNode2D` directly
(index.ts), so `length` and `initial_offset` are never read at all, valid or not —
an out-of-range `length = 70000` or a non-numeric `initial_offset = far` is silently
dropped rather than substituted or warned on, consistent with the node rendering as
a transform-only group (ADR-0008).
