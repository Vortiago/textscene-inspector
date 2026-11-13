# A canvas item reads what it inherits from the canvas item pass

- Status: Accepted
- Related: ADR-0060 (a scene pass that crosses an instance runs on the live tree).

## Context

Godot folds what a canvas item inherits in one walk of the canvas: the modulate product, `z_final`,
the material that `use_parent_material` reaches and the texture sampler (`renderer_canvas_cull.cpp:430-434`,
`canvas_item.cpp:235-253`). The preview drew the same facts through React context: each item
published its modulate, z, material and sampler for its subtree, and a Control that the Control walk
promoted past skipped Node2D items folded those items again from the solve. Two folds of one rule
can disagree, and a lifted item, a scene tile or a y-sorted child read the context of the group it
mounts in, which is not always its parent item.

## Decision

The canvas item pass (`canvasItemPass`) computes, for each live path, what the item inherits. Every
drawn item reads it from the pass, through `useInheritedCanvasState(path)`.

- A drawn item publishes a `CanvasParent` for its subtree: its path when the pass holds it, or the
  state it hands down when it is drawn outside the shared live tree (a Control of a walk's own tree,
  a lifted node of a scene tile, an embedded window frame).
- A second item drawn for one node, such as a TileMap layer's row, takes that node's own inheritance.
- A chain start (`CanvasRootScope`, `CanvasLayerScope`, `SubViewportCanvasScope`) publishes
  `CHAIN_START_PARENT`.
- The Control walk runs the pass on its own tree. Each `SolveNode.inheritance` lists the links from
  the walk's root down, and the walk folds them over what the item around the walk hands down.
- A painter reads what its item hands down through `useEnclosingCanvasState()`.
- Readers compare the state by value (`sameInherited`), so a pass run for another node's change
  re-renders no item.

The context per facet, `CanvasItemChildScope` and `SkippedCanvasItemsScope` are gone.
`SolveNode.skippedTransform` holds the transform, which the walk composes as a whole matrix.

## Draw sequence

The paint pass (`canvasPaintPass`) allocates, for each live path, the draw sequence of the item's own
pixels and the runs its children, internal front and back children and listed layer take
(`renderer_canvas_cull.cpp:477-490`). The world walk and the Control walk both read it, so the two
walks cannot give one item two sequences.

- It is a pass of its own beside `canvasItemPass`, because it allocates for every node, including a
  node that is no canvas item, and a y-sort re-packs its runs after the fold.
- A node type declares the room it holds with `registerPaintRoom` in its parser slice, not in
  `index.r3f.ts`. The Control renderers load lazily, so a room registered with them would change the
  numbers once they load.
- A subtree outside the shared live tree, such as a scene tile's instance, takes a paint frame: a run
  it allocates from with the same rule. A y-sort hands its rows a frame that shifts the pass's run.

## Measurement

`scenes/fixtures/perf-modulate-200-sprites.tscn` holds one Node2D root with 200 Sprite2D descendants,
three levels deep, in 10 rows of 20. A measurement build patched the root's `modulate` every frame,
since a pushed `modulate` track has no reader. Frame time is the mean and the 95th percentile of 360
`requestAnimationFrame` deltas after 60 warm-up frames, in headless Chromium on SwiftShader.

| Variant | Run 1 mean / p95 (ms) | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Scopes | 47.04 / 66.70 | 49.07 / 66.70 | 49.21 / 83.30 |
| Pass read, scopes still mounted | 47.64 / 66.70 | 49.12 / 66.70 | 48.66 / 83.30 |
| Scopes, again after the pass runs | 48.93 / 83.30 | 48.61 / 66.70 | 47.22 / 66.70 |

The pass read costs 1.003 times the mean of the six scope runs (48.47 ms against 48.35 ms). The
rule of #1528 removes the scopes at a cost of at most 1.10.

## Considered Options

- **Keep the scopes, and read the pass beside them.** Rejected. The pass read costs the same frame
  time as the scopes (see Measurement), so the second fold buys nothing.
- **Fold the skipped items into each Control again in the walk.** Rejected. It repeats the pass's
  rule in a second place, which is the disagreement this record removes.
