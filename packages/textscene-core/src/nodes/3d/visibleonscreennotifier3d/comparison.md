---
type: VisibleOnScreenNotifier3D
category: 3D
status: limitation
fixture: unit-visible-on-screen-notifier-3d.tscn
# image: unit-visible-on-screen-notifier-3d
visual: false
renders_as: a selection-gated box gizmo
---

# VisibleOnScreenNotifier3D

Reports whether its `aabb` is on screen through `screen_entered` and `screen_exited` signals. It draws nothing at runtime. Godot's editor draws a gizmo of the box, and the previewer draws it while the node is selected (ADR-0018). Unlike its 2D sibling, this class has no draw call at all.

## Gizmo

A selected notifier draws the gizmo of Godot's editor. Godot's source is `visible_on_screen_notifier_3d_gizmo_plugin.cpp:149-194`.

- The 12 edges of `aabb`, in the editor's notifier colour.
- Three segments of length 1 from the centre of the box, along +X, +Y and +Z.
- A fill of the box with an opacity of 0.1.

An unauthored box is Godot's default, an AABB from (-1, -1, -1) of size 2. The previewer draws the lines and the fill in the local space of the node, so they follow its transform. It draws no edit handles and no billboard icon.

## Linting

<!-- lint:begin VisibleOnScreenNotifier3D -->
Strict parsing format-checks these `VisibleOnScreenNotifier3D` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `aabb` | AABB(x, y, z, w, h, d) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

The lenient parser reads `aabb` for the gizmo. A malformed value keeps Godot's default box, and only strict reports it. `layers` is inherited from VisualInstance3D and is covered on that sheet.

## Known limitations

- **Editor only** Godot's editor draws the edges and the axes faintly for every notifier, but ADR-0018 draws them only for the selected node.
