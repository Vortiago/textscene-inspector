---
type: Window
category: 2D
fixture: unit-window-embedded.tscn
renders_as: its viewport's target in a themed frame, drawn by its embedder
---

# Window

The node that creates a window, and the base of AcceptDialog, Popup and PopupPanel. The previewer
draws a visible Window as its embedder does (ADR-0033). The window's Controls draw into its target.
The embedder then draws the frame, the title, the close icon and the target over its canvas.

## Decoration
<!-- compare: image=unit-window-embedded status=done fixture=unit-window-embedded.tscn -->

A decorated window draws the `embedded_border` frame, its title centred in the `title_height` band
and the close icon, then its Controls.

## Focus and stack order
<!-- compare: image=unit-window-focus-order status=done fixture=unit-window-focus-order.tscn -->

The last focusable window takes the focus and the `embedded_border` frame. Every other window
takes `embedded_unfocused_border`, and a window registered later draws over an earlier one.

## Title trim
<!-- compare: image=unit-window-title-trim status=done fixture=unit-window-title-trim.tscn -->

A title wider than the space between the frame and the close icon ends in an ellipsis.

## Transparent
<!-- compare: image=unit-window-transparent status=done fixture=unit-window-transparent.tscn -->

A `transparent` window clears its target to no colour, so the embedder shows through it.

## Wrap controls
<!-- compare: image=unit-window-wrap status=done fixture=unit-window-wrap.tscn -->

With `wrap_controls`, the window grows to hold its Controls. A centred window centres the size it
loaded with, so it grows to the right and down.

A size line also clamps the size to the contents minimum while `wrap_controls` is on at that line,
so a dialog whose `size` comes before `wrap_controls = false` still grows. That minimum reads each
Control as it was when it first computed its minimum, because a Control outside the tree keeps it.

## Theme overrides
<!-- compare: image=unit-window-theme status=done fixture=unit-window-theme.tscn -->

The `embedded_border` StyleBox, `title_color`, `title_font_size` and a `title_outline_size` ring
override the default theme.

## Right-to-left parent
<!-- compare: image=unit-window-rtl status=done fixture=unit-window-rtl.tscn -->

A window under a right-to-left Control lays its Controls out from the right. Its title trims from
the start and the close icon stays at the right edge. Window has no `layout_direction` key of its own.

## Theme scale
<!-- compare: image=unit-window-theme-scale status=done fixture=window-theme-scale/unit-window-theme-scale.tscn -->

With `gui/theme/default_theme_scale` at 1.5, the frame, the title font and the close icon grow
with the theme. The close icon is the browser raster of the scaled SVG, so its edge pixels differ by a rim
from Godot's ThorVG raster. At theme scale 1 the icon is Godot's own raster and matches.

## Under a SubViewport that does not embed
<!-- compare: image=unit-window-under-disabled-viewport status=done fixture=unit-window-under-disabled-viewport.tscn -->

A window under a SubViewport without `gui_embed_subwindows` draws in the root viewport. It
updates as the root does, though the SubViewport never updates.

## A window above a window
<!-- compare: image=unit-window-in-window status=done fixture=unit-window-in-window.tscn -->

Under a root that embeds windows, a window embeds none, whatever `gui_embed_subwindows` it authors.
The root draws the window below it, once, at its position in the root.

## Force native on a visible window
<!-- compare: image=edge-window-force-native-visible status=done fixture=edge-window-force-native-visible.tscn -->

Godot refuses `force_native` on a window that is visible when the line is read, so the window stays
embedded. The value stands only where an earlier line hides the window, or the class starts hidden.

## Content scale
<!-- compare: image=unit-window-content-scale status=done fixture=unit-window-content-scale.tscn -->

`content_scale_factor` scales the window's Controls. `content_scale_size` with a mode and an
aspect gives the design rect, and black bars fill the rest of the window.

## Linting

<!-- lint:begin Window -->
Strict parsing format-checks these `Window` properties, plus 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `accessibility_description` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `accessibility_name` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
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
| `theme` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `theme_override_colors/*` | Color(r, g, b, a), or the colour string or int it converts |  |
| `theme_override_constants/*` | integer -16384-16384 | warning |
| `theme_override_font_sizes/*` | integer >= 1 | warning below |
| `theme_override_fonts/*` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `theme_override_icons/*` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `theme_override_styles/*` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `theme_type_variation` | quoted string or &"name" |  |
| `title` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
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
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
|  | `window-force-native-refused-while-visible` | error |
<!-- lint:end -->

The lenient parser reads every Window key it draws with. A malformed value takes the class default,
as an unset key does, and no diagnostic comes from the lenient path.

## Known limitations

- **Approximated** The title glyph edges differ from Godot's by the same amount as a Label's in the
  default font.
- **Approximated** At theme scale 1.5 the title text of a dialog sits 1 px right of Godot's.
- **Not drawn** A window that holds `force_native`, or one that no viewport embeds, draws nothing, as
  it opens as a system window in a running game.
