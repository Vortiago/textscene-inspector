---
type: AnimatableBody2D
category: 2D
status: linter-only
fixture: unit-animatable-body-2d.tscn
# image: unit-animatable-body-2d
visual: false
renders_as: nothing (a transform-only group)
---

# AnimatableBody2D

A kinematic 2D body meant to be moved by code, an AnimationMixer or a RemoteTransform2D. It draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008) and its children still show.

## Linting

<!-- lint:begin AnimatableBody2D -->
Strict parsing format-checks these `AnimatableBody2D` properties, plus 3 inherited from StaticBody2D, 5 inherited from CollisionObject2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `sync_to_physics` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-collisionobject2d` (type-family match) | `collisionobject2d-needs-collision-shape` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which reads only Node2D's own keys, so a malformed `sync_to_physics = maybe` is dropped rather than substituted.
