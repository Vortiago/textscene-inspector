# Where a Control lands in the solve tree

`useBuildSolveTree` (`buildSolveTree.ts`) gives no `SolveNode` to a non-Control ancestor, a type
not in `TWO_D_UI_TYPES`, and walks its children in its place. Where a Control beneath it lands
follows Godot. `NOTIFICATION_ENTER_CANVAS` climbs `CanvasItem` parents for a Control
(`control.cpp:3874-3890`), and `_enter_canvas` parents the item where the climb ends
(`canvas_item.cpp:234-285`).

## The climb

- A `Node2D` is a `CanvasItem`, so the Control is promoted to the nearest real Control. The
  Node2D's transform, `modulate` and `z_index` ride along in `SolveNode.skippedAncestors`. As a
  grandchild it anchors against a zero rect, and no Container above lays it out
  (`controlRectSolver.ts`).
- A `Node3D` or raw `Node` breaks the climb: the Control is a canvas root, hoisted to the nearest
  canvas boundary or the forest roots. Nothing above the break reaches it, and it draws at its
  pre-order rank among that canvas's roots (`canvasRootRanges`).
- A `CanvasLayer` or `ParallaxBackground` also ends the climb, but keeps a `SolveNode`, so
  hoisted Controls land there.
- `top_level` ends the climb wherever it appears: the loop is
  `while (!node->is_set_as_top_level())` (`control.cpp:3876`). On the Control itself it strips
  `skippedAncestors`, since `get_parent_item()` returns nullptr first
  (`canvas_item.cpp:565-571`). No Container lays it out (`container.cpp:144-146`).

## Visibility

Visibility is a scene-tree rule, not a canvas one. `NOTIFICATION_ENTER_TREE` casts the direct
parent with no `top_level` test (`canvas_item.cpp:311-316`), and `_handle_visibility_change`
reaches top_level children too (`canvas_item.cpp:103-108`). So visibility crosses both breaks on
`SolveNode.parentVisibleInTree`, and resets only where `childParentVisibleInTree` does.
