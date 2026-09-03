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

BackBufferCopy copies a screen region into the render backbuffer for shader code to
sample; it draws nothing of its own, so the previewer renders it as a transform-only
group (ADR-0008) and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `copy_mode` | `2` (Viewport) | buffers the whole screen rather than `rect` |
| `rect` | `Rect2(-50, -50, 100, 100)` | the buffered region when `copy_mode` is Rect |

## Divergences

None. BackBufferCopy draws nothing at runtime in either engine — only its
children's rendering, which this node does not affect.

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

BackBufferCopy reuses `parseNode2D`, which never reads `copy_mode` or `rect` at all —
both are absent from the parsed properties regardless of value, valid or malformed,
because this node draws nothing for either to affect.
