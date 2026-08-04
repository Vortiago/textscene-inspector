---
type: HSplitContainer
category: 2D
status: unreviewed
fixture: unit-split-container.tscn
renders_as: two children side by side, split at a computed offset
---

# HSplitContainer

A SplitContainer is not a flow container. Where a BoxContainer places children
one after another and lets each child's size flags size it, `_resort` solves for
ONE number and derives both rects from it
(`scene/gui/split_container.cpp`):

```cpp
fit_child_in_rect(first,  Rect2(Point2(0, 0), Size2(computed_split_offset, get_size().height)));
int sofs = computed_split_offset + sep;
fit_child_in_rect(second, Rect2(Point2(sofs, 0), Size2(get_size().width - sofs, get_size().height)));
```

A child's own flags never size it here; they only choose how it sits inside the
rect it was handed. The DOM form is therefore a **grid**, whose two tracks are
those rects — `grid-template-columns: <computed_split_offset> 1fr`, with the
separation as the gap.

## `_compute_split_offset`

```cpp
int split_offset_with_collapse = collapsed ? 0 : split_offset;
if (first_is_expanded && second_is_expanded) {
    float ratio = first->get_stretch_ratio() / (first->get_stretch_ratio() + second->get_stretch_ratio());
    wished_size = size * ratio - sep * 0.5 + split_offset_with_collapse;
} else if (first_is_expanded) {
    wished_size = size - sep + split_offset_with_collapse;
} else {
    wished_size = split_offset_with_collapse;
}
computed_split_offset = CLAMP(wished_size, first_min_size, size - sep - second_min_size);
```

`_is_expanded` reads `SIZE_EXPAND` on the SPLIT axis only — the horizontal flags
for HSplit, the vertical ones for VSplit. There is no `else if
(second_is_expanded)` branch: a second-only expander takes the same path as
neither.

## Properties exercised

| Property | Effect |
| --- | --- |
| `split_offset` | Displaces the boundary from its rest position, in pixels. Read as 0 while `collapsed`. |
| `collapsed` | Pins the boundary at rest. Does **not** hide the dragger or remove the separation. |
| `dragger_visibility` | 0=VISIBLE, 1=HIDDEN, 2=HIDDEN_COLLAPSED. Only **2** removes the separation — `_get_separation` returns 0 for it alone. |
| `theme_override_constants/separation` | Floored by the grabber icon's extent: `MAX(theme_cache.separation, g->get_width())`. |
| child `size_flags_horizontal` | `SIZE_EXPAND` selects the branch above; `SIZE_FILL` and the shrink bits place the child inside its rect. |
| child `size_flags_stretch_ratio` | Weights the both-expanded split. |

Measured through Godot 4.6.3 on `unit-split-container.tscn` — 400 px wide rows,
scanned for the colour edge (first | gap | second):

| Row | Authored | Godot |
| --- | --- | --- |
| Both | both expand | 194 \| 12 \| 194 |
| Offset | `split_offset = 60` | 254 \| 12 \| 134 |
| Ratio | `stretch_ratio` 3 : 1 | 294 \| 12 \| 94 |
| FirstOnly | only the first expands | 388 \| 12 \| 0 |
| Neither | neither, `split_offset = 120` | 120 \| 12 \| 268 |
| SepZero | `separation` overridden to 0 | 196 \| **8** \| 196 |
| Collapsed | `collapsed`, `split_offset = 60` | 194 \| 12 \| 194 |
| DraggerCollapsed | `dragger_visibility = 2` | 200 \| **0** \| 200 |

So the default separation is **12** and the grabber's own extent is **8** —
`SepZero` is what measures the latter, since the override cannot go below it.

## Divergences

- **The dragger is not drawn and cannot be dragged.** The previewer renders an
  authored scene, and `split_offset` is the authored state; the grabber icon,
  its hover/pressed states and `dragging_area_control` have no still-frame
  meaning. The separation it occupies IS reproduced, because it moves both
  rects.
- **`CLAMP(wished, first_min, size - sep - second_min)` is not applied.** It
  needs both children's `get_combined_minimum_size()`, which are content
  measurements the browser performs and CSS cannot name in a track expression.
  The track's own `min-width: 0` plus the container's `overflow: hidden`
  reproduce the clipping half; a child whose minimum size exceeds its rect is
  clipped here where Godot would have pushed the boundary.
- **`theme_override_icons/grabber` does not change the separation.** Godot
  floors the separation at the OVERRIDING icon's width; here the default
  grabber's 8 px is always the floor. Visible in
  `scenes/demos/2d/platformer/game_splitscreen.tscn`, which overrides the
  grabber with a 2 px `GradientTexture1D` and `separation = 0`: Godot's gap is
  2 px, the previewer's is 8.
- **Only the first two sortable children are laid out**, as in Godot — a third
  child lands in a zero-sized implicit track and is not drawn.

## Linting

<!-- lint:begin HSplitContainer -->
Strict parsing format-checks the inherited set (10 inherited from SplitContainer, 27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `HSplitContainer` declares none of its own. Every validator failure is an **error**. `HSplitContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts |
| --- | --- |
| `vertical` | **not available on this type** |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Strict and lenient parsing do not diverge here, because neither parser
interprets these three properties beyond their scalar types: `split_offset` is
any int (Godot clamps it at layout time, not at load), `collapsed` is a bool,
and `dragger_visibility` is an enum Godot itself accepts out of range —
`_get_separation` only tests it against `DRAGGER_HIDDEN_COLLAPSED`, so an
unknown value behaves as VISIBLE on both sides. A malformed value leaves the
property undefined and the Godot default applies.

The layout has nothing structural to lint. "Fewer than two children" is not a
defect — Godot fits a lone child to the whole container, and a
SplitContainer is a perfectly ordinary single-child wrapper while a scene is
being built up.
