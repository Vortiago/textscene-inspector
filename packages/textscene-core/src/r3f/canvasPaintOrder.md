# Canvas paint order

`canvasPaintOrder.ts` gives each canvas item one integer that reproduces Godot's 2D draw order.

## The key

Godot draws a canvas in a single pre-order walk. `_attach_canvas_item_for_draw`
(`servers/rendering/renderer_canvas_cull.cpp` lines 274-283) appends each visible item to a
linked list indexed by the item's accumulated `z_final`. Godot then draws those lists in z order.
The order key is therefore exactly three things, in this precedence:

```text
(canvas layer, z_final, position in the walk)
```

An item's node type is in none of them. A `Control` and a `Sprite2D` interleave by this key
alone: a background `ColorRect` authored as the first child of a root draws under the sprites
that follow it.

## The key in three

three orders transparent meshes by `groupOrder`, then `renderOrder`
(`three/src/renderers/webgl/WebGLRenderLists.js`), and every 2D material here writes no depth.
`groupOrder` is the `renderOrder` of the nearest enclosing `Group`
(`WebGLRenderer.js:1838-1840`). So an item's wrapper group carries this key, and the meshes
inside it keep a small `renderOrder` for private layering.

## Ranges

A node owns the contiguous range `[base, base + size)`, and its descendants are allocated inside
it, so a y-sort pass re-packs its own range alone. A canvas root (`isCanvasRoot`) draws at its
pre-order rank among the canvas's roots instead, from the end of the enclosing root's range
(`canvasRootRanges`).
