---
type: Skeleton2D
category: 2D
status: unimplemented
fixture: unit-skeleton-2d.tscn
# image: unit-skeleton-2d
visual: false
renders_as: nothing yet, its modification stack does not run, and its bones deform the Polygon2Ds bound to it
---

# Skeleton2D

Skeleton2D is the root of a Bone2D chain. A Polygon2D that names it in `skeleton` draws
each vertex where its weighted bones move it from their rest. Godot also runs the
`modification_stack` on the bones each frame, and the previewer does not yet (ADR-0045).

## Linting

<!-- lint:begin Skeleton2D -->
Strict parsing format-checks these `Skeleton2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `modification_stack` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

Strict checks `modification_stack` for reference format only. The lenient parser reuses
`parseNode2D` and never reads it, so a malformed value flows through untouched.

## Known limitations

- **Needs runtime** The `modification_stack` is never solved, so bones stay at their
  authored transforms where Godot's IK would move them each frame.
