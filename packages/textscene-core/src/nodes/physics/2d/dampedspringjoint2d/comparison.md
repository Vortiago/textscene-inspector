---
type: DampedSpringJoint2D
category: 2D
status: linter-only
fixture: unit-damped-spring-joint-2d.tscn
# image: unit-damped-spring-joint-2d
visual: false
renders_as: nothing (a transform-only group)
---

# DampedSpringJoint2D

Connects two 2D physics bodies with a spring-like force. It draws nothing at runtime, since Godot shows the spring only as an editor gizmo, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `length` | `80.0` | none, the spring's maximum extent, not drawn |
| `rest_length` | `40.0` | none, the length the spring relaxes toward, not drawn |
| `stiffness` | `20.0` | none, how strongly the spring resists deformation, not drawn |
| `damping` | `1.0` | none, how fast the attached bodies realign to the spring axis, not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin DampedSpringJoint2D -->
Strict parsing format-checks these `DampedSpringJoint2D` properties, plus 4 inherited from Joint2D, 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `damping` | float 0.01-16 |
| `length` | float 1-65535 |
| `rest_length` | float 0-65535 |
| `stiffness` | float 0.1-64 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-joint` (type-family match) | `joint-not-connected` | warning |
|  | `joint-same-body` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's own keys, so a
malformed `stiffness` (or any of this type's other three properties) never reaches
`node.properties`: it is silently ignored rather than substituted with a default,
and only the raw text survives on `node.rawProperties`.
