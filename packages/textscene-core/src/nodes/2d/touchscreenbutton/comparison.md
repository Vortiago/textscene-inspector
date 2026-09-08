---
type: TouchScreenButton
category: 2D
status: unimplemented
fixture: unit-touch-screen-button.tscn
# image: unit-touch-screen-button
renders_as: invisible transform-only fallback
---

# TouchScreenButton

TouchScreenButton is an on-screen button for touch input that draws `texture_normal` or
`texture_pressed`. The previewer parses and validates it but does not draw it, so it
renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin TouchScreenButton -->
Strict parsing format-checks these `TouchScreenButton` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `action` | quoted string or &"name" |  |
| `bitmask` | null, SubResource("id") or ExtResource("id") |  |
| `passby_press` | true or false |  |
| `shape` | null, SubResource("id") or ExtResource("id") |  |
| `shape_centered` | true or false |  |
| `shape_visible` | true or false |  |
| `texture_normal` | null, SubResource("id") or ExtResource("id") |  |
| `texture_pressed` | null, SubResource("id") or ExtResource("id") |  |
| `visibility_mode` | enum 0-1 (ALWAYS/TOUCHSCREEN_ONLY) | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The slice has no `parser.ts`. `index.ts` registers `parseNode2D`, which reads none of
the nine keys, so an unquoted `action` or an out-of-range `visibility_mode` is carried
through raw and never rendered.

## Known limitations

- **Not drawn** Godot draws the button's texture. The previewer draws nothing for this
  node.
