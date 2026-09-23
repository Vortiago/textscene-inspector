# One draw-order key for every canvas item, Controls included

- Status: Accepted. **Amends ADR-0037**: this ADR replaces the Control-only band that
  ADR-0037's "`renderOrder`, not a fractional z offset, for draw order" section chose. The rest of
  ADR-0037, the native Control rendering, stands.
- Related: ADR-0006 (the 2D workspace), ADR-0033 (a sub-viewport is a canvas boundary
  and draws into a target of its own, so it starts a fresh key range).

## Context

Godot draws a canvas in a single pre-order walk. Each visible item is appended to a
linked list indexed by its accumulated `z_final` (`_attach_canvas_item_for_draw`,
`servers/rendering/renderer_canvas_cull.cpp:274-283`), and those lists are then drawn in
z order. The behind/ahead child split of `_cull_canvas_item` (`:477-490`) is the only
reordering in the walk. So the order key is three things, in this precedence:

    (canvas layer, z_final, position in the walk)

An item's node **type is in none of them**. A `Control` and a `Sprite2D` are both
`CanvasItem`s and interleave purely by that key. "UI draws over the world" comes from the
convention that UI is authored last, not from a rule in the renderer.

Two separate, incomparable schemes get this wrong:

- `z_final` in the group's `position.z` (`z_index × 0.1`) gives no draw sequence in the
  plain case: ties fall through to `THREE.Object3D.id`, that is React mount order.
- A Control band, `(layer, paint index)` in `renderOrder` starting one stride above world
  content, wins before tree order is read, because `renderOrder` outranks camera distance
  in three's transparent sort. Each layer-0 Control then draws above all world content.
  A background `ColorRect` authored as the first child of a root, the normal way to write
  a 2D backdrop, covers the sprites after it. Godot does not do this.

## Decision

One key, `(layerRank, z_final, sequence)`, packed into a single integer and carried by
the wrapper group of each canvas item, Node2D-family and Control alike
(`packages/textscene-core/src/r3f/canvasPaintOrder.ts`).

**It rides `groupOrder`, and the meshes inside keep their own `renderOrder`.** three
compares `groupOrder`, the `renderOrder` of the nearest enclosing `Group`
(`WebGLRenderer.js:1838-1840`), before the drawn object's own. That gives two ordinal
levels, which is what the two rules need: the canvas key above, and an item's private
layering below it (an atlas batch's source index, a `ScrollContainer`'s bars). The key
never makes room for sub-item detail.

**A group between an item and its pixels resets `groupOrder` for everything inside it**,
so such a group must carry the item's key too. For example, `StyleBoxQuad`'s y-flip
group without the key puts each StyleBox at the front of the canvas.

**Layers are ranked, not used raw.** `CanvasLayer.layer` is a plain int32 assignment in
Godot (`CanvasLayer::set_layer`. Its `PROPERTY_HINT_RANGE` is an editor-slider hint, not
a clamp), so the raw value as a coefficient would use up the safe-integer budget alone.
Only its order has meaning. Ranking ties the key's magnitude to how many layers a scene
declares. The key must stay a *safe* integer, because three compares `renderOrder` with
`!==`, and a key that lost precision would silently tie items that must not tie.

**Sequence is allocated as contiguous ranges.** A node owns `[base, base + size)`, and
its descendants are allocated inside it. So the y-sort pass can re-order the items it
collected without reading anything outside its own subtree: it re-packs its own range.
Two node kinds draw pieces the tree does not list (a y-sorted tile layer's per-row
groups, an `instance=` node's sub-scene roots), so they reserve room in advance. That
keeps the allocation a pure function of the tree, so the world walk and the Control walk
derive the same numbers without talking to each other.

**A canvas root draws from the tail of the range it is nested in.** An item whose own
parent is not a `CanvasItem`, or whose own `top_level` is set, parents at the canvas. It
is drawn in its pre-order rank among that canvas's roots, each root's subtree whole,
never at the slot its nesting gives it. Its run is carved from the end of the enclosing
root's range, which is after that root's whole subtree and before the next root. The
enclosing root reserves the room the same way a dynamic node does.

## Consequences

Fractional `+Z` is not an ordering mechanism anywhere. A 2D scene occupies no depth: each
canvas item sits in the z=0 plane. Integers remove the scarcity that a fractional band
must ration, so a tile batch's source offset is the batch's index.

`CanvasLayer.layer` orders world content as well as Controls.

One limit stays: a legacy `TileMap`'s per-layer `z_index` orders its layers against each
other but not against the node's siblings. Godot gives each layer its own `CanvasItem`,
and the node draws as one canvas item here.
