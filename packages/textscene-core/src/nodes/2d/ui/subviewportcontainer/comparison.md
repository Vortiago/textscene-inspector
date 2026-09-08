---
type: SubViewportContainer
category: 2D
status: unreviewed
fixture: unit-sub-viewport-container.tscn
# image: unit-sub-viewport-container
renders_as: a clipped surface showing its SubViewport children's targets
---

# SubViewportContainer

SubViewportContainer shows its SubViewport children's render targets, and the previewer
draws it as a viewport surface (ADR-0030). Controls inside the sub-viewport render
straight into it as DOM, and 2D or 3D content is snapshotted from the offscreen target
into a canvas beneath them.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-subviewportcontainer-children` | `subviewportcontainer-no-viewport` | warning |
|  | `subviewportcontainer-non-arrow-cursor` | warning |
<!-- lint:end -->

Strict errors on a `stretch_shrink` below `1`, which Godot's setter refuses. The lenient
parser warns and falls back to `1`, and a non-boolean `stretch` falls back to `false`.
The `subviewportcontainer-no-viewport` rule stays silent when a child is an `instance=`
node, whose root the linter cannot inspect.

## Known limitations

- **Needs runtime** The surface samples the target on a bounded schedule and then stops,
  so an animation inside a sub-viewport shows its settled frame.
- **Approximated** Dark gradients inside a sub-viewport band slightly more, since the
  target quantises to 8-bit linear before the sRGB curve expands the darks.
- **Approximated** The container does not take Godot's minimum size from its largest
  child viewport, so a layout container can size it differently.
- **Needs runtime** A sub-viewport a script populates in `_ready()` shows only what the
  `.tscn` holds. A split-screen view that shares a world at runtime differs from Godot.
