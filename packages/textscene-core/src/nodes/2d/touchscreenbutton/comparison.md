---
type: TouchScreenButton
category: 2D
status: unimplemented
fixture: unit-touch-screen-button.tscn
# image: unit-touch-screen-button
renders_as: invisible transform-only fallback
---

# TouchScreenButton

TouchScreenButton is an on-screen button for touch input; Godot draws its `texture_normal`/`texture_pressed` and the previewer parses and validates the node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture_normal` | `SubResource("PlaceholderTexture2D_normal")` | Format-checked only; the previewer draws nothing regardless. |
| `texture_pressed` | `SubResource("PlaceholderTexture2D_pressed")` | Format-checked only. |
| `bitmask` | `SubResource("BitMap_1")` | Format-checked only. |
| `shape` | `SubResource("CircleShape2D_1")` | Format-checked only. |
| `shape_centered` | `true` | Format-checked only. |
| `shape_visible` | `true` | Format-checked only. |
| `passby_press` | `false` | Format-checked only. |
| `action` | `"ui_accept"` | Format-checked only; existence in an InputMap is out of scope. |
| `visibility_mode` | `1` (`VISIBILITY_TOUCHSCREEN_ONLY`) | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin TouchScreenButton -->
Strict parsing format-checks these `TouchScreenButton` properties, plus 12 inherited from Node2D, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `action` | quoted string or &"name" |
| `bitmask` | SubResource("id") or ExtResource("id") |
| `passby_press` | true or false |
| `shape` | SubResource("id") or ExtResource("id") |
| `shape_centered` | true or false |
| `shape_visible` | true or false |
| `texture_normal` | SubResource("id") or ExtResource("id") |
| `texture_pressed` | SubResource("id") or ExtResource("id") |
| `visibility_mode` | enum 0-1 (ALWAYS/TOUCHSCREEN_ONLY) |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

This slice has no `parser.ts`: `index.ts` registers `parseNode2D`, which reads
none of these nine keys. So an unquoted `action` or an out-of-range
`visibility_mode` has no fallback value to substitute — the lenient parse
carries the raw string through untouched and it never reaches a render, since
nothing downstream reads it yet. `action` itself accepts either the plain
`"…"` quoted string Godot actually saves (`get_action` returns `String`) or
the `&"…"` StringName literal, because the variant text parser reads both
forms. `visibility_mode` beyond `0`-`1` is only a WARNING (ADR-0032): the
`PROPERTY_HINT_ENUM` at touch_screen_button.cpp:442 states the bound but
`set_visibility_mode` (cpp:374-377) assigns it with no `ERR_FAIL_INDEX`.
