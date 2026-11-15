---
type: CanvasGroup
category: 2D
fixture: unit-canvas-group-self-modulate.tscn
image: unit-canvas-group-self-modulate
renders_as: its children drawn into one buffer, composited by one rect
---

# CanvasGroup

CanvasGroup draws its children at its own `z_final` into one transparent buffer, then draws one
rect over their bounds that blends the buffer once. The rect multiplies the buffer by the group's
`modulate` and `self_modulate`, and the children take the `modulate` too, so its alpha applies
twice.

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

The lenient parser keeps the default 10 for a negative `fit_margin` or `clear_margin`, which each
setter refuses. `clear_margin` and `use_mipmaps` change no pixel: only a group shader that reads
the buffer's mipmaps would show them.

## Modulate

<!-- compare: image=unit-canvas-group-modulate status=done fixture=unit-canvas-group-modulate.tscn -->

The group's `modulate` reaches the squares and the rect, so the composite is fainter than the plain
Node2D beside it.

## A child at another z

<!-- compare: image=unit-canvas-group-z-escape status=done fixture=unit-canvas-group-z-escape.tscn -->

A child whose `z_final` differs from the group's draws on its own, outside the buffer.

## Material

<!-- compare: image=unit-canvas-group-material status=done fixture=unit-canvas-group-material.tscn -->

A CanvasItemMaterial on the group replaces the group shader. The rect draws white times the group
colour with the material's blend mode, and the children stay in the buffer, unseen.

## Nested group

<!-- compare: image=unit-canvas-group-nested status=done fixture=unit-canvas-group-nested.tscn -->

A group inside another group draws as a plain white rect of its own colour into the outer buffer,
and the outer group composites both.

## Y-sorted group

<!-- compare: image=unit-canvas-group-y-sort status=done fixture=unit-canvas-group-y-sort.tscn -->

A y-sorted CanvasGroup groups nothing, so its children draw as a Node2D's would. A group under a
y-sorted parent composites as usual.

## Known limitations

- **Shader missing** A ShaderMaterial on the group draws the default group shader in its place.
