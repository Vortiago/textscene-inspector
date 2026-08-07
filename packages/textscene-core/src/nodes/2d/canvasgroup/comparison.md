---
type: CanvasGroup
category: 2D
status: unimplemented
fixture: unit-canvas-group.tscn
# image: unit-canvas-group
renders_as: invisible transform-only fallback; the children's composite into one offscreen buffer is not reproduced
---

# CanvasGroup

Godot composites a CanvasGroup's children into one offscreen buffer and draws that
buffer as a single canvas item — the effect this exists for is overlapping
semi-transparent children blending against each other, then the whole group
blending once against the background, rather than each child blending against
the background individually. The previewer does not reproduce that compositing
step, so it parses and validates this node but draws it as an invisible
transform-only fallback and its children still show, each blending against the
background on its own.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `fit_margin` | `16.0` | margin expanding the drawable rect fitted around the children |
| `clear_margin` | `16.0` | margin expanding the backbuffer clear rect |
| `use_mipmaps` | `true` | mipmaps computed for the backbuffer, for a custom ShaderMaterial |

## Divergences

No image pair exists for this fixture (status `unimplemented`). The behavioural
gap is the compositing step described above: any overlapping semi-transparent
children in this fixture would render differently, blended individually against
the background instead of once through the group's own buffer.

## Linting

<!-- lint:begin CanvasGroup -->
Strict parsing format-checks these `CanvasGroup` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `clear_margin` | float >= 0 |
| `fit_margin` | float >= 0 |
| `use_mipmaps` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-canvasgroup-ancestry` | `canvasgroup-ancestor-clips-children` | warning |
|  | `canvasgroup-nested-in-canvasgroup` | warning |
<!-- lint:end -->

CanvasGroup reuses the plain `parseNode2D`, which never reads `fit_margin`,
`clear_margin`, or `use_mipmaps` at all — all three are absent from the parsed
properties regardless of value, valid or malformed, since this node draws
nothing itself for any of them to affect.
