---
type: Window
category: Other
status: unimplemented
fixture: unit-window.tscn
# image: unit-window
renders_as: nothing yet, not implemented
---

# Window

The node that creates a window, and the base of AcceptDialog, ConfirmationDialog, Popup, PopupMenu, PopupPanel and FileDialog. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group and its children still show.

## Linting

<!-- lint:begin Window -->
Strict parsing format-checks these `Window` properties, plus 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accessibility_description` | quoted string, or the &"…" StringName jacket |  |
| `accessibility_name` | quoted string, or the &"…" StringName jacket |  |
| `always_on_top` | true or false |  |
| `borderless` | true or false |  |
| `content_scale_aspect` | enum 0-4 (IGNORE/KEEP/KEEP_WIDTH/KEEP_HEIGHT/EXPAND) | warning |
| `content_scale_factor` | float 0.5-8 | error at or below 0, warning below 0.5, warning above 8 |
| `content_scale_mode` | enum 0-2 (DISABLED/CANVAS_ITEMS/VIEWPORT) | warning |
| `content_scale_size` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `content_scale_stretch` | enum 0-1 (FRACTIONAL/INTEGER) | warning |
| `current_screen` | integer >= 0 | warning below |
| `exclude_from_capture` | true or false |  |
| `exclusive` | true or false |  |
| `extend_to_title` | true or false |  |
| `force_native` | true or false |  |
| `initial_position` | enum 0-5 (ABSOLUTE/CENTER_PRIMARY_SCREEN/CENTER_MAIN_WINDOW_SCREEN/CENTER_OTHER_SCREEN/CENTER_SCREEN_WITH_MOUSE_FOCUS/CENTER_SCREEN_WITH_KEYBOARD_FOCUS) | warning |
| `keep_title_visible` | true or false |  |
| `max_size` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `maximize_disabled` | true or false |  |
| `min_size` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `minimize_disabled` | true or false |  |
| `mode` | enum 0-4 (WINDOWED/MINIMIZED/MAXIMIZED/FULLSCREEN/EXCLUSIVE_FULLSCREEN) | warning |
| `mouse_passthrough` | true or false |  |
| `mouse_passthrough_polygon` | PackedVector2Array(x, y, …) |  |
| `nonclient_area` | Rect2i(x, y, w, h), or the Rect2 spelling Godot converts |  |
| `popup_window` | true or false |  |
| `popup_wm_hint` | true or false |  |
| `position` | Vector2i(x, y), or the Vector2 spelling Godot converts |  |
| `sharp_corners` | true or false |  |
| `size` | Vector2i(x, y), both >= 0, or the Vector2 spelling Godot converts | error below |
| `theme` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_colors/*` | Color(r, g, b, a) |  |
| `theme_override_constants/*` | integer -16384-16384 | warning |
| `theme_override_font_sizes/*` | integer >= 1 | warning below |
| `theme_override_fonts/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_icons/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_override_styles/*` | null, SubResource("id") or ExtResource("id") |  |
| `theme_type_variation` | quoted string or &"name" |  |
| `title` | quoted string, or the &"…" StringName jacket |  |
| `transient` | true or false |  |
| `transient_to_focused` | true or false |  |
| `transparent` | true or false |  |
| `unfocusable` | true or false |  |
| `unresizable` | true or false |  |
| `visible` | true or false |  |
| `wrap_controls` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
<!-- lint:end -->

The lenient parser registers the plain `Node` reader, which reads only the heading attributes and an optional `transform`. A malformed `mode` or any other Window key is never read, substituted or reported, and the node mounts as the same empty group either way.

## Known limitations

- **Not drawn** Godot displays the window and its Control children at runtime. The previewer draws nothing for it.
