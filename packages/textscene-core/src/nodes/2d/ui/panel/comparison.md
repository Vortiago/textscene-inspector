---
type: Panel
category: 2D
status: unreviewed
fixture: unit-panel.tscn
image: unit-panel
renders_as: a StyleBox-painted <div>
---

# Panel

A `Panel` is a bare rectangular Control that paints its `theme_override_styles/panel`
StyleBox and holds free-anchored children. The previewer renders it as a positioned
`<div>` whose CSS is derived from that StyleBox.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| offsets (`-160..160`, `-100..100`) | centred | a 320×200 box in the middle of the frame |
| `bg_color` | `Color(0.16, 0.17, 0.22, 1)` | the dark navy fill |
| `corner_radius_*` | `8` | the rounded corners |
| `border_width_*` | `2` | the thin visible edge |
| `border_color` | `Color(0.4, 0.45, 0.6, 1)` | the light blue-grey of that edge |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Panel -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `Panel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

Panel adds no properties of its own: it forwards straight to `parseControl`, so
there is no Panel-specific lenient fallback beyond what Control already covers.

## Known limitations

- **StyleBoxFlat.border_blend** — with `border_blend = true` Godot fades the border from `border_color` into `bg_color`; we map borders to a solid CSS border with a sharp edge. Defaults to false; no corpus fixture enables it.
