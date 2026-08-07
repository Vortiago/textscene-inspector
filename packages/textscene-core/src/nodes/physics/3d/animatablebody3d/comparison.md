---
type: AnimatableBody3D
category: 3D
status: linter-only
fixture: unit-animatable-body-3d.tscn
# image: unit-animatable-body-3d
visual: false
renders_as: nothing (a transform-only group)
---

# AnimatableBody3D

A `StaticBody3D` meant to be moved by code, `AnimationMixer`, or `RemoteTransform3D` rather than physics forces; it draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `sync_to_physics` | `false` | none: controls whether motion is synced to the physics step, not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin AnimatableBody3D -->
Strict parsing format-checks these `AnimatableBody3D` properties, plus 3 inherited from StaticBody3D, 6 inherited from CollisionObject3D, 16 inherited from Node3D, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `sync_to_physics` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-collisionobject3d-scale` (type-family match) | `collisionobject3d-non-uniform-scale` | warning |
| `valid-staticbody3d` (type-family match) | `valid-staticbody3d-resources` | error |
|  | `staticbody3d-needs-collision-shape` | warning |
|  | `staticbody3d-constant-velocity-warning` | warning |
|  | `staticbody3d-zero-collision-layer` | warning |
|  | `staticbody3d-zero-collision-mask` | warning |
<!-- lint:end -->

AnimatableBody3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), which reads only `transform` and `visible`, so `sync_to_physics` is
never read at all, valid or not. A non-boolean value like `sync_to_physics = "maybe"`
is silently dropped rather than substituted or warned on, consistent with the node
rendering as a transform-only group (ADR-0008). Confirmed empirically in
animatablebody3d.test.ts: the parsed node's `properties` never carries the key,
only its `rawProperties`.
