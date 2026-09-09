---
type: BackBufferCopy
category: 2D
status: linter-only
fixture: unit-back-buffer-copy.tscn
# image: unit-back-buffer-copy
visual: false
renders_as: nothing (a transform-only group)
---

# BackBufferCopy

BackBufferCopy copies a screen region into the backbuffer for shaders to sample. It
draws nothing of its own, so the previewer renders it as a transform-only group
(ADR-0008) and its children still show.

## Linting

<!-- lint:begin BackBufferCopy -->
Strict parsing format-checks these `BackBufferCopy` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `copy_mode` | enum 0-2 (Disabled/Rect/Viewport) | warning |
| `rect` | Rect2(x, y, w, h), or the Rect2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser reuses `parseNode2D`, which never reads `copy_mode` or `rect`. Both
keys are dropped whatever their value, valid or malformed.
