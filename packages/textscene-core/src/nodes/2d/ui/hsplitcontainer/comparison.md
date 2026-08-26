---
type: HSplitContainer
category: 2D
status: unreviewed
fixture: unit-split-container.tscn
image: unit-split-container
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
rect it was handed.

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

| Row | Authored | Godot | Ours |
| --- | --- | --- | --- |
| Both | both expand | 194 \| 12 \| 194 | same |
| Offset | `split_offset = 60` | 254 \| 12 \| 134 | same |
| Ratio | `stretch_ratio` 3 : 1 | 294 \| 12 \| 94 | same |
| FirstOnly | only the first expands | 388 \| 12 \| 0 | same |
| Neither | neither, `split_offset = 120` | 120 \| 12 \| 268 | same |
| SepZero | `separation` overridden to 0 | 196 \| **8** \| 196 | same |
| Collapsed | `collapsed`, `split_offset = 60` | 194 \| 12 \| 194 | same |
| DraggerCollapsed | `dragger_visibility = 2` | 200 \| **0** \| 200 | same |

"same" is literal: the two renders are byte-identical over the whole 1152x648
frame.

So the default separation is **12** and the grabber's own extent is **8** —
`SepZero` is what measures the latter, since the override cannot go below it.

## Divergences

`pnpm ref:godot scenes/fixtures/unit-split-container.tscn --mode 2d` and
`pnpm ref:ours unit-split-container.tscn --2d` are byte-identical — all eight
rows, every `_compute_split_offset` branch, the same boundaries.

- **Neither side draws a dragger, and that is Godot's own behaviour here.**
  A probe down the middle of the first row's separation (x 222, y 18..82) reads
  the bare rgb(0, 0, 102) backdrop on BOTH sides: Godot gates the grabber icon
  on hover/drag, and a static frame has neither. `split_offset` is the authored
  state, and the separation the dragger occupies IS reproduced, because it moves
  both rects.
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
Strict parsing format-checks the inherited set (35 inherited from Control); `HSplitContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
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

## Native (WebGL canvas) painter

`shared/splitContainerSolver.ts` ports `_update_default_dragger_positions`/
`_update_dragger_positions`/`_resort`/`get_minimum_size`, restricted to
exactly two children (a closed form of the same source, see the module's own
doc). `Component.tsx` draws only the
grabber icon between the two children `ControlCanvasWalker` already places as
siblings; the container itself paints nothing else — `split_bar_background`
(`default_theme.cpp:1275-1277`) is an EMPTY stylebox.

### Known limitations (native)

- **The grabber icon is drawn** only once a scene overrides
  `theme_override_constants/autohide` to `0`. Godot's own `autohide` theme
  constant defaults to `1` (true), hiding the icon absent a hover/drag state a
  static render never has. Verified against `pnpm ref:godot --mode 2d`,
  probing the gap between every row of `unit-split-container.tscn`: every
  probe reads back the plain backdrop colour, never the grabber's gray. So for
  every fixture and every scene in this repo's corpus today, no grabber is
  drawn.
- **`CLAMP(wished, first_min, size - sep - second_min)` IS applied**, with
  full `combined_minimum_size` access from the registered solver — the two
  CHILD rects are always exact. The grabber ICON's own recomputed position, on
  the rare scene where it is ever visible, instead uses each child's OWN
  `custom_minimum_size` only, not the full recursive minimum a Native painter
  has no channel to reach (`Component.tsx`'s own doc) — bounded to the icon's
  own (already off-by-default) pixels, never the actual child boundary.
- **`theme_override_icons/grabber` still does not change the separation**,
  same as the `game_splitscreen.tscn` case.

### Known limitations (native only)

- **Dragging** is out of scope — only the authored `split_offset` renders.
