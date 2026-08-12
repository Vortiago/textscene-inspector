---
type: AspectRatioContainer
category: 2D
status: unimplemented
fixture: unit-aspect-ratio-container.tscn
# image: unit-aspect-ratio-container
renders_as: invisible transform-only fallback
---

# AspectRatioContainer

A Container that resizes its child controls to keep a fixed width/height ratio as the
container itself is resized, choosing where to fit or crop them via `stretch_mode` and
where to align the result via `alignment_horizontal`/`alignment_vertical`. It is a
Control (ADR-0003 routes Controls through the 2D DOM overlay, not the WebGL scene), so
the previewer parses and validates every member below but does not draw it yet: it
renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `ratio` | `1.5` | width divided by height each child is scaled toward |
| `stretch_mode` | `3` | `STRETCH_COVER`: children are scaled to cover the container, cropping past its edges |
| `alignment_horizontal` | `0` | `ALIGNMENT_BEGIN`: children sit against the left edge |
| `alignment_vertical` | `2` | `ALIGNMENT_END`: children sit against the bottom edge |

## Divergences

Not captured yet, nothing renders, so there is nothing to compare pixels against.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-aspectratiocontainer-children` | `aspectratiocontainer-unsupported-texturerect-expand-mode` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all four of AspectRatioContainer's own members; `linter.ts`
adds one semantic rule for a direct TextureRect child whose `expand_mode` is proportional
(3 or 5), which Godot's own sort pass skips positioning at runtime. None of this affects the
rendered fallback today: `index.ts` reuses `parseControl` unchanged (ADR-0003, the node draws
nothing), which reads none of `ratio`, `stretch_mode`, `alignment_horizontal`, or
`alignment_vertical`. So a bad value on any of the four is not substituted with a fallback by
the lenient parser; it is simply never read at all, and the fallback render is unchanged
regardless of what strict parsing would warn about.
