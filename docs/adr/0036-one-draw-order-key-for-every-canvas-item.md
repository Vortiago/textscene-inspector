# One draw-order key for every canvas item, Controls included

- Status: Accepted (2026-08-13). **Amends ADR-0037**, whose "`renderOrder`, not a
  second z-banding scheme" section chose a Control-only band; that band is replaced
  here. The rest of ADR-0037 — the native Control rendering it decided — stands.
- Related: ADR-0006 (the 2D workspace); ADR-0033 (a sub-viewport is a canvas
  boundary, and draws into a target of its own, so it starts a fresh key range).

## Context

Godot draws a canvas in a single pre-order walk. Each visible item is appended to a
linked list indexed by its accumulated `z_final`
(`_attach_canvas_item_for_draw`, `servers/rendering/renderer_canvas_cull.cpp:274-283`),
and those lists are then drawn in z order. `_cull_canvas_item`'s behind/ahead child
split (`:477-490`) is the only reordering in the walk. So the order key is exactly
three things, in this precedence:

    (canvas layer, z_final, position in the walk)

An item's node **type is in none of them**. A `Control` and a `Sprite2D` are both
`CanvasItem`s and interleave purely by that key. The widespread impression that "UI
draws over the world" comes from UI conventionally being authored last, not from any
rule in the renderer.

Two schemes had grown up here instead, and they were not comparable with each other:

- **World content** put `z_final` in the group's `position.z` (`z_index × 0.1`), and
  had no draw sequence at all in the plain case — ties fell through to
  `THREE.Object3D.id`, i.e. React mount order. Only a y-sort subtree assigned distinct
  positions, by dividing a shrinking fractional band across nesting depth.
- **Controls** put `(layer, paint index)` in `renderOrder`, in a band that started one
  whole stride *above* world content, and approximated `z_index` by pre-sorting
  siblings inside the Control tree.

`renderOrder` outranks camera distance in three's transparent sort, so the band won
before tree order was ever consulted: **every** layer-0 Control drew above **all**
world content, unconditionally. A background `ColorRect` authored as the first child
of a root — how a 2D backdrop is normally written — covered the sprites that followed
it. The band's own module documented this as matching Godot. It does not.

## Decision

One key, `(layerRank, z_final, sequence)`, packed into a single integer and carried by
every canvas item's wrapper group — Node2D-family and Control alike
(`packages/textscene-core/src/r3f/canvasPaintOrder.ts`).

**It rides `groupOrder`, and the meshes inside keep their own `renderOrder`.** three
compares `groupOrder` — the `renderOrder` of the nearest enclosing `Group`
(`WebGLRenderer.js:1838-1840`) — before the drawn object's own. That gives exactly two
ordinal levels, which is exactly what the two rules need: the canvas key above, and an
item's private layering below it (an atlas batch's source index, a `ScrollContainer`'s
bars). The key never has to make room for sub-item detail.

The consequence to know: **a group between an item and its pixels resets `groupOrder`
for everything inside it**, so such a group must carry the item's key too. This is a
real hazard — `StyleBoxQuad`'s y-flip group hit it, which would have put every
StyleBox in the previewer at the front of the canvas.

**Layers are ranked, not used raw.** `CanvasLayer.layer` is a plain int32 assignment in
Godot (`CanvasLayer::set_layer`; its `PROPERTY_HINT_RANGE` is an editor-slider hint,
not a clamp), so the raw value as a coefficient would exhaust the safe-integer budget
on its own. Only its order carries meaning. Ranking ties the key's magnitude to how
many layers a scene actually declares — and the key must stay a *safe* integer, since
three compares `renderOrder` with `!==` and a key that lost precision would silently
tie items that must not tie.

**Sequence is allocated as contiguous ranges.** A node owns `[base, base + size)` and
its descendants are allocated inside it. That is what lets the y-sort pass re-order the
items it collected without consulting anything outside its own subtree — it re-packs
its own range. Two node kinds draw pieces the tree does not list (a y-sorted tile
layer's per-row groups, an `instance=` node's sub-scene roots), so they hold room back
up front; that keeps the allocation a pure function of the tree, which is what lets the
world walk and the Control walk derive the same numbers without talking to each other.

**A canvas root draws from the tail of the range it is nested in.** An item whose own
parent is not a `CanvasItem`, or whose own `top_level` is set, parents at the canvas and
is drawn in its pre-order rank among that canvas's roots, each root's subtree whole —
never at the slot its nesting gives it. Its run is carved from the end of the enclosing root's range, which is after
that root's whole subtree and still before the next root, and the enclosing root holds
the room back the same way a dynamic node does.

## Consequences

Fractional `+Z` is no longer an ordering mechanism anywhere. `Z_INDEX_STEP`,
`YSORT_FINE_RANGE`, `TILE_LAYER_STEP`/`TILE_SOURCE_STEP`, `canvasItemZ`, the
y-sort slot-width budget and its `tileSourceZ` fraction-of-band all went with it, along
with the Control band module. A 2D scene now occupies no depth at all: every canvas
item sits in the z=0 plane. Integers removed the scarcity that machinery existed to
ration — `tileSourceZ` in particular existed *only* because a fixed nudge overshot a
band that narrowed as a scene grew, and is now just the batch's index.

`CanvasLayer.layer` orders world content as well as Controls, where the band reached
Controls alone.

Two limits are unchanged rather than introduced, and are worth stating because this
work moved the code around them:

- A legacy `TileMap`'s per-layer `z_index` orders its layers against each other but not
  against the node's siblings — Godot gives each layer its own `CanvasItem`. The node
  draws as one canvas item here.
- A Control under a `Node2D` ancestor is still positioned from its solved rect against
  the viewport rather than the composed CanvasItem transform chain (ADR-0037's own
  recorded limitation). Draw ORDER is now correct for that case even though position
  is not.
