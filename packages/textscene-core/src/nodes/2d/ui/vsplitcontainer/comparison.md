---
type: VSplitContainer
category: 2D
status: unreviewed
fixture: unit-split-container-vertical.tscn
renders_as: two children stacked, split at a computed offset
---

# VSplitContainer

The same class as `HSplitContainer` with `vertical = true`; the solve, the
properties and the divergences are all documented there. `_resort` swaps which
axis the computed offset sizes:

```cpp
fit_child_in_rect(first,  Rect2(Point2(0, 0), Size2(get_size().width, computed_split_offset)));
int sofs = computed_split_offset + sep;
fit_child_in_rect(second, Rect2(Point2(0, sofs), Size2(get_size().width, get_size().height - sofs)));
```

The axis is load-bearing beyond the obvious, because `_compute_split_offset`
reads `SIZE_EXPAND` on the SPLIT axis only:

```cpp
bool first_is_expanded = (vertical ? first->get_v_size_flags() : first->get_h_size_flags()) & SIZE_EXPAND;
```

so a child that expands horizontally claims nothing here, and a VSplitContainer
whose children carry only `size_flags_horizontal` takes the "neither expands"
branch — its boundary sits at `split_offset`, not at the middle. That is why
`unit-split-container-vertical.tscn` exists as a separate fixture: the
horizontal one passes whether the implementation reads the right axis or not.

Measured through Godot 4.6.3 — 300 px tall columns (top | gap | bottom):

| Column | Authored | Godot |
| --- | --- | --- |
| Both | both expand vertically | 144 \| 12 \| 144 |
| Offset | `split_offset = 50` | 194 \| 12 \| 94 |

## Linting

<!-- lint:begin VSplitContainer -->
Strict parsing format-checks the inherited set (10 inherited from SplitContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VSplitContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `VSplitContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

Identical to HSplitContainer's, and for the same reason: the three properties
it adds are plain scalars that Godot clamps or ignores at layout time rather
than at load, so strict and lenient parsing have nothing to disagree about. A
malformed value leaves the property undefined and the Godot default applies.
