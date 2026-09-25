---
type: SubViewportContainer
category: 2D
status: limitation
fixture: unit-sub-viewport-container.tscn
image: unit-sub-viewport-container
renders_as: a clipped surface showing its SubViewport children's targets
---

# SubViewportContainer

SubViewportContainer shows its SubViewport children's render targets, drawn as a
surface in the canvas (ADR-0030).

## Linting

<!-- lint:begin SubViewportContainer -->
Strict parsing format-checks these `SubViewportContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `mouse_target` | true or false |  |
| `stretch` | true or false |  |
| `stretch_shrink` | integer >= 1 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-subviewportcontainer-children` | `subviewportcontainer-no-viewport` | warning |
|  | `subviewportcontainer-non-arrow-cursor` | warning |
<!-- lint:end -->

Strict errors on a `stretch_shrink` below `1`, which Godot's setter refuses. The lenient
parser warns and falls back to `1`, and a non-boolean `stretch` falls back to `false`.
The `subviewportcontainer-no-viewport` rule stays silent when a child's class lives
elsewhere. That child is an `instance=` node, whose root the linter cannot inspect, or a
class the pinned catalog does not list.

## Known limitations

- **Needs runtime** A sub-viewport a script fills when the game starts shows only what the
  scene file holds, so a shared-world split screen differs from Godot.
