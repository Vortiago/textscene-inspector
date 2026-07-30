---
type: Window
category: Other
status: unimplemented
fixture: unit-window.tscn
# image: unit-window
renders_as: nothing yet — not implemented
---

# Window

A node that creates a window — the base class AcceptDialog, ConfirmationDialog, Popup, PopupMenu, PopupPanel and FileDialog all build on. It genuinely draws at runtime (it displays its Control children), but the previewer only parses and validates it today; it does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mode` | `0` (Windowed) | not drawn yet — the window mode (windowed/minimized/maximized/fullscreen) |
| `title` | `"Sample Window"` | not drawn yet — the title bar text |
| `initial_position` | `1` (Center of Primary Screen) | not drawn yet — where the window first appears |
| `position` | `Vector2i(100, 100)` | not drawn yet — screen position in pixels |
| `size` | `Vector2i(640, 480)` | not drawn yet — window size in pixels |
| `current_screen` | `0` | not drawn yet — which monitor the window occupies |
| `nonclient_area` | `Rect2i(0, 0, 640, 32)` | not drawn yet — custom decoration hit-test region |
| `mouse_passthrough_polygon` | `PackedVector2Array(0, 0, 640, 0, 640, 480, 0, 480)` | not drawn yet — polygon region that accepts mouse events |
| `visible` | `true` | not drawn yet — whether the window shows at all |
| `wrap_controls` | `false` | not drawn yet — auto-resize to fit child Controls |
| `transient` | `false` | not drawn yet — considered a child of another Window |
| `transient_to_focused` | `false` | not drawn yet — transient parent follows focus |
| `exclusive` | `false` | not drawn yet — blocks input to its parent Window |
| `unresizable` | `false` | not drawn yet — disables user resizing |
| `borderless` | `false` | not drawn yet — hides the OS window border |
| `always_on_top` | `false` | not drawn yet — stays above other windows |
| `transparent` | `false` | not drawn yet — allows a transparent background |
| `unfocusable` | `false` | not drawn yet — can't be focused or interacted with |
| `popup_window` | `false` | not drawn yet — behaves as a popup |
| `extend_to_title` | `false` | not drawn yet — content expands under the title bar |
| `mouse_passthrough` | `false` | not drawn yet — passes all mouse events through |
| `sharp_corners` | `false` | not drawn yet — overrides OS rounded corners |
| `exclude_from_capture` | `false` | not drawn yet — excluded from OS screenshots |
| `popup_wm_hint` | `false` | not drawn yet — signals a WM "popup" hint |
| `minimize_disabled` | `false` | not drawn yet — disables the minimize button |
| `maximize_disabled` | `false` | not drawn yet — disables the maximize button |
| `force_native` | `false` | not drawn yet — forces a native OS window |
| `min_size` | `Vector2i(320, 240)` | not drawn yet — smallest allowed window size |
| `max_size` | `Vector2i(1920, 1080)` | not drawn yet — largest allowed window size |
| `keep_title_visible` | `true` | not drawn yet — widens the window to keep the title readable |
| `content_scale_size` | `Vector2i(1280, 720)` | not drawn yet — base "virtual pixel" content size |
| `content_scale_mode` | `1` (Canvas Items) | not drawn yet — how content scales when resized |
| `content_scale_aspect` | `1` (Keep) | not drawn yet — aspect handling for content scaling |
| `content_scale_stretch` | `0` (Fractional) | not drawn yet — fractional vs. integer scale factor |
| `content_scale_factor` | `1.0` | not drawn yet — base content scale multiplier |
| `accessibility_name` | `"Main window"` | not drawn yet — name reported to assistive apps |
| `accessibility_description` | `"The application's main window"` | not drawn yet — description reported to assistive apps |
| `theme` | `SubResource("Theme_1")` | not drawn yet — theme resource for the window and its Control children |
| `theme_type_variation` | `&"WindowTitle"` | not drawn yet — theme type lookup override |
| `theme_override_colors/title_color` | `Color(1, 1, 1, 1)` | not drawn yet — title text color override |
| `theme_override_constants/title_height` | `36` | not drawn yet — title bar height override |
| `theme_override_fonts/title_font` | `SubResource("SystemFont_1")` | not drawn yet — title font override |
| `theme_override_font_sizes/title_font_size` | `20` | not drawn yet — title font size override |
| `theme_override_icons/close` | `SubResource("PlaceholderTexture2D_1")` | not drawn yet — close-button icon override |
| `theme_override_styles/embedded_border` | `SubResource("StyleBoxFlat_1")` | not drawn yet — embedded-window background style override |

## Divergences

No capture exists yet — Window is `status: unimplemented`, so there is nothing to
compare against Godot.

## Linting

<!-- lint:begin Window -->
Strict parsing format-checks these `Window` properties. Every validator failure is an **error**.

| Property |
| --- |
| `accessibility_description` |
| `accessibility_name` |
| `always_on_top` |
| `borderless` |
| `content_scale_aspect` |
| `content_scale_factor` |
| `content_scale_mode` |
| `content_scale_size` |
| `content_scale_stretch` |
| `current_screen` |
| `exclude_from_capture` |
| `exclusive` |
| `extend_to_title` |
| `force_native` |
| `initial_position` |
| `keep_title_visible` |
| `max_size` |
| `maximize_disabled` |
| `min_size` |
| `minimize_disabled` |
| `mode` |
| `mouse_passthrough` |
| `mouse_passthrough_polygon` |
| `nonclient_area` |
| `popup_window` |
| `popup_wm_hint` |
| `position` |
| `sharp_corners` |
| `size` |
| `theme` |
| `theme_override_colors/*` |
| `theme_override_constants/*` |
| `theme_override_font_sizes/*` |
| `theme_override_fonts/*` |
| `theme_override_icons/*` |
| `theme_override_styles/*` |
| `theme_type_variation` |
| `title` |
| `transient` |
| `transient_to_focused` |
| `transparent` |
| `unfocusable` |
| `unresizable` |
| `visible` |
| `wrap_controls` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-window-properties` | `window-max-size-below-min-size` | warning |
<!-- lint:end -->

The lenient parser (`parser.ts`) reuses the plain `Node` parser: it reads only the
`[node]` heading's `name`/`parent`/`instance`/`index` attributes plus an optional
`transform` property, and never looks at any Window-specific key at all. A bad
`mode` value like `mode = "banana"`, or any other malformed property the strict
linter above rejects, is never read, substituted, or reported by the lenient
path — the node still renders as the same empty transform-only group either way.
