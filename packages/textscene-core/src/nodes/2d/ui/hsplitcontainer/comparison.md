---
type: HSplitContainer
category: 2D
status: limitation
fixture: unit-split-container.tscn
image: unit-split-container
renders_as: two children side by side, split at a computed offset
---

# HSplitContainer

HSplitContainer places two children side by side, split where `split_offset` puts the
boundary, with the dragger's band between them.

## Linting

<!-- lint:begin HSplitContainer -->
Strict parsing format-checks the inherited set (10 inherited from SplitContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HSplitContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `HSplitContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

Neither parser reads `split_offset`, `collapsed` or `dragger_visibility` beyond its
scalar type, and an out-of-range `dragger_visibility` behaves as VISIBLE on both sides.
A malformed value leaves the property `undefined` and Godot's default applies.

## Known limitations

- **Approximated** A `theme_override_icons/grabber` does not widen the gap between the
  children, which stays at the default grabber's width.
