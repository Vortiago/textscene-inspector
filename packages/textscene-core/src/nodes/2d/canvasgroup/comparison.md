---
type: CanvasGroup
category: 2D
status: unimplemented
fixture: unit-canvas-group.tscn
# image: unit-canvas-group
renders_as: invisible transform-only fallback, the children's composite into one offscreen buffer is not reproduced
---

# CanvasGroup

CanvasGroup composites its children into one offscreen buffer and blends that buffer
once. The previewer parses and validates it but does not reproduce the compositing, so
it renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin CanvasGroup -->
Strict parsing format-checks these `CanvasGroup` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `clear_margin` | float >= 0 | error below |
| `fit_margin` | float >= 0 | error below |
| `use_mipmaps` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-canvasgroup-ancestry` | `canvasgroup-ancestor-clips-children` | warning |
|  | `canvasgroup-nested-in-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which never reads `fit_margin`, `clear_margin`
or `use_mipmaps`. All three are dropped whatever their value.

## Known limitations

- **Not drawn** Overlapping semi-transparent children blend against the background one
  by one, not once through the group's buffer.
