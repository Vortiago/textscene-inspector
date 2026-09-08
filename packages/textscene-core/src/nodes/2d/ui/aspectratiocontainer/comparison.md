---
type: AspectRatioContainer
category: 2D
status: unimplemented
fixture: unit-aspect-ratio-container.tscn
# image: unit-aspect-ratio-container
renders_as: invisible transform-only fallback
---

# AspectRatioContainer

AspectRatioContainer resizes its children to keep a fixed width-to-height ratio, fitting
or cropping them by `stretch_mode`. The previewer parses and validates it but does not
draw it, so it renders as a transform-only fallback and its children still show.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-aspectratiocontainer-children` | `aspectratiocontainer-unsupported-texturerect-expand-mode` | info |
<!-- lint:end -->

`index.ts` reuses `parseControl` unchanged, which reads none of `ratio`, `stretch_mode`,
`alignment_horizontal` or `alignment_vertical`. A bad value on any of them is never
read, so no fallback applies. `linter.ts` adds one rule for a direct TextureRect child
whose `expand_mode` is proportional, which Godot's sort pass skips.

## Known limitations

- **Not drawn** Godot scales and aligns the children to the ratio. The previewer applies
  no layout, so they stay at their authored offsets.
