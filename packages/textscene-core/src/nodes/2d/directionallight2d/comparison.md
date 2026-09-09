---
type: DirectionalLight2D
category: 2D
status: unimplemented
fixture: unit-directional-light-2d.tscn
# image: unit-directional-light-2d
renders_as: an invisible transform-only fallback
---

# DirectionalLight2D

DirectionalLight2D casts an infinite directional light over the whole canvas. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin DirectionalLight2D -->
Strict parsing format-checks these `DirectionalLight2D` properties, plus 15 inherited from Light2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `height` | float 0-1 | warning |
| `max_distance` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which has no field for `height` or
`max_distance`. Either key is dropped whatever its value, with no fallback substituted.

## Known limitations

- **Not drawn** Godot lights the canvas from this node. The previewer applies no light
  for it.
