---
type: AspectRatioContainer
category: 2D
status: unreviewed
fixture: unit-aspect-ratio-container.tscn
# image: unit-aspect-ratio-container
renders_as: each child scaled and aligned to a fixed ratio
---

# AspectRatioContainer

AspectRatioContainer scales and aligns every child to a fixed width-to-height ratio,
fitting, covering, or driving one axis from the other per `stretch_mode`. It draws
nothing itself. A right-to-left `layout_direction` mirrors the horizontal alignment, so
`alignment_horizontal` Begin puts the child against the right edge.

## Linting

<!-- lint:begin AspectRatioContainer -->
Strict parsing format-checks these `AspectRatioContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment_horizontal` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `alignment_vertical` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `ratio` | float >= 0.001 | warning below |
| `stretch_mode` | enum 0-3 (STRETCH_WIDTH_CONTROLS_HEIGHT/STRETCH_HEIGHT_CONTROLS_WIDTH/STRETCH_FIT/STRETCH_COVER) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-aspectratiocontainer-children` | `aspectratiocontainer-unsupported-texturerect-expand-mode` | info |
<!-- lint:end -->

`parser.ts` now reads all four members straight through, unclamped — the same values
`linterParser.ts` only warns about. The solver applies `aspect_ratio_container.h`'s own
defaults (`ratio` 1.0, `stretch_mode` FIT, both alignments CENTER) and, for an
out-of-range `stretch_mode`, falls through to no scaling at all, matching the engine's
own unmatched-`switch` behaviour. `linter.ts`'s rule for a direct TextureRect child with
a proportional `expand_mode` names a child the solver also skips from sorting, matching
Godot's own sort pass.
