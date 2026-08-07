---
type: TextureButton
category: 2D
status: unimplemented
fixture: unit-texture-button.tscn
# image: unit-texture-button
renders_as: invisible transform-only fallback
---

# TextureButton

TextureButton is BaseButton's sprite-based button: five texture slots (normal,
pressed, hover, disabled, focused) plus a click mask and a stretch mode, instead
of Godot's Theme resource. The previewer parses and validates every member below
but does not draw it yet: it renders as an invisible transform-only fallback and
its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `flip_h` | `true` | mirrors every texture slot horizontally |
| `flip_v` | `true` | mirrors every texture slot vertically |
| `ignore_texture_size` | `true` | the button's minimum size ignores the texture dimensions |
| `stretch_mode` | `4` (`STRETCH_KEEP_ASPECT`) | scales the drawn texture to fit the rect while keeping its aspect ratio |
| `texture_click_mask` | a `BitMap` | restricts the clickable area to the mask's white pixels |
| `texture_disabled` | a `PlaceholderTexture2D` | drawn when `disabled` is true |
| `texture_focused` | a `PlaceholderTexture2D` | overlaid when the button has focus |
| `texture_hover` | a `PlaceholderTexture2D` | drawn while the mouse hovers |
| `texture_normal` | a `PlaceholderTexture2D` | the default, not-pressed appearance |
| `texture_pressed` | a `PlaceholderTexture2D` | drawn while the button is pressed |

## Divergences

Not captured yet, since nothing renders and there is nothing to compare pixels against.

## Linting

<!-- lint:begin TextureButton -->
Strict parsing format-checks these `TextureButton` properties, plus 10 inherited from BaseButton, 28 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `flip_h` | true or false |
| `flip_v` | true or false |
| `ignore_texture_size` | true or false |
| `stretch_mode` | enum 0-6 (STRETCH_SCALE/STRETCH_TILE/STRETCH_KEEP/STRETCH_KEEP_CENTERED/STRETCH_KEEP_ASPECT/STRETCH_KEEP_ASPECT_CENTERED/STRETCH_KEEP_ASPECT_COVERED) |
| `texture_click_mask` | SubResource("id") or ExtResource("id") |
| `texture_disabled` | SubResource("id") or ExtResource("id") |
| `texture_focused` | SubResource("id") or ExtResource("id") |
| `texture_hover` | SubResource("id") or ExtResource("id") |
| `texture_normal` | SubResource("id") or ExtResource("id") |
| `texture_pressed` | SubResource("id") or ExtResource("id") |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

The lenient parser reuses `parseControl`, which reads only Control/CanvasItem
fields (anchors, offsets, modulate, theme overrides) and has no field for any of
TextureButton's own 10 members. A bad value on any of them, say
`stretch_mode = 12`, a malformed `Color(...)` on an inherited key, or a plain
string on `texture_normal`, is silently dropped: `parseControl` never reads the
key, so the node still parses with its children intact and no trace of the bad
value survives.
StrictTscnParser sees the same raw key independent of `parseControl`, which is
why the validators above catch what the lenient path silently drops.
