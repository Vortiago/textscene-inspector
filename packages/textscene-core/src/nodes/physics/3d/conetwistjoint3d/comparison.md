---
type: ConeTwistJoint3D
category: 3D
status: linter-only
fixture: unit-cone-twist-joint-3d.tscn
# image: unit-cone-twist-joint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# ConeTwistJoint3D

A physics joint that connects two 3D physics bodies as a ball-and-socket joint; it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008), and Godot itself shows the cone only as an editor-only gizmo that never appears in a runtime capture either.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `swing_span` | `0.6981317` (40° in radians) | none: the swing cone's half-angle away from the twist axis; not drawn |
| `twist_span` | `1.5707963` (90° in radians) | none: how far the joint can twist around its own axis; not drawn |
| `bias` | `0.4` | none: how fast the swing or twist correction happens; not drawn |
| `softness` | `0.9` | none: how easily the joint starts to twist; not drawn |
| `relaxation` | `1.2` | none: how fast the swing/twist speed difference between the two bodies syncs; not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin ConeTwistJoint3D -->
Strict parsing format-checks these `ConeTwistJoint3D` properties, plus 4 inherited from Joint3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `bias` | float 0.01-16 |
| `relaxation` | float 0.01-16 |
| `softness` | float 0.01-16 |
| `swing_span` | radians, -180° to 180° |
| `twist_span` | radians, -40000° to 40000° |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

`index.ts` registers `parseNode3D` directly, which reads only `transform` and
`visible`, so an out-of-range `swing_span` or a malformed `bias` is silently
dropped from the lenient tree rather than substituted or warned on: the parsed
node's `properties` never carries these keys at all, valid or not, consistent
with rendering as a transform-only group (ADR-0008).
