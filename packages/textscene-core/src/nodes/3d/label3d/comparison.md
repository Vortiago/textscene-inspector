---
type: Label3D
category: 3D
fixture: unit-label3d.tscn
image: unit-label3d
renders_as: a canvas-textured plane
---

# Label3D

Label3D draws a single line of text on a flat plane in 3D space. The previewer rasterises
each label to a canvas texture, maps it onto a transparent `PlaneGeometry` sized by
`pixel_size`, tints it by `modulate`, and orients it per the node's `billboard` mode. All
four labels render by default.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Billboard Enabled"` … | the glyph string each label shows |
| `pixel_size` | `0.01` / `0.015` | world size per glyph pixel; the `0.015` "Outlined Text" reads larger |
| `billboard` | `1` / `0` / `2` | `1` faces the camera upright (yellow, white); `0` holds a fixed orientation, so the cyan label skews with the pitched camera and runs off-frame; `2` yaws around Y only, so the magenta label reads foreshortened |
| `modulate` | `Color(1,1,0,1)` … | tints the glyphs — yellow, cyan, magenta, white |
| `outline_size` | `8` | black outline width around "Outlined Text" |
| `outline_modulate` | `Color(0,0,0,1)` | the outline colour, black |

## Divergences

Glyph shapes differ — a Chromium fallback font on our side versus Godot's bundled default —
so letterforms, weight, and kerning vary across all four labels. This is inherent to
rasterising through the browser's font stack.

Text presence, colour, placement, per-label size, billboard orientation, and the black
outline on "Outlined Text" all match. The canvas texture is now premultiplied, so the
glyphs no longer carry a dark halo, and the outline is scaled to Godot's thinner
font-outline weight rather than a heavy centred stroke.

`context.font` is hardcoded to `Arial`, which Godot never uses (its default project font
is a bundled Noto/OpenSans-derived face, not a system font at all), so the divergence
exists on every host regardless of what is installed — only its exact magnitude moves
with the host's font substitution. On a host with no `Arial` face, Linux `fontconfig`
resolves the canvas request to whatever sits in its `sans-serif` chain (`fc-match Arial`
resolves to Noto Sans on a bare Fedora/Debian box), which is a different substitution
again from whatever face a Mac or Windows dev machine would have supplied when a golden
PNG was captured there.

This scales with how much text a scene carries: `example-hallway-mockup.tscn` places 11
Label3D nodes across the frame, and re-rendering it against Godot 4.6.3 puts every
edge-antialiasing byte of drift for that scene inside those 11 labels' silhouettes — 0
elsewhere in a 955×756 frame. Rebuilding the exact commit that captured that scene's
`scripts/visual/baselines/hallway-mockup.png` reproduces the same 168 px / 0.023%
`pnpm test:visual` delta against its own golden that later commits also show, which rules
out a code regression: the gap was already there the day the golden was written, just on
a host whose font substitution didn't match this one's. It is a fixed cost of rasterising
through the browser's font stack, not something a later change introduced or a later
change can close — closing it for real means shipping Godot's actual bundled font as a
web font, a separate undertaking, not a fix to any one label-rendering code path.

## Linting

<!-- lint:begin Label3D -->
Strict parsing format-checks these `Label3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `billboard` |
| `font_size` |
| `horizontal_alignment` |
| `line_spacing` |
| `modulate` |
| `no_depth_test` |
| `outline_modulate` |
| `outline_size` |
| `pixel_size` |
| `text` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-label3d-properties` | `label3d-empty-text` | warning |
|  | `label3d-large-pixel-size` | warning |
<!-- lint:end -->

`pixel_size`, `outline_size`, `font_size`, and `line_spacing` fall back through `floatOr`, with a warning, to `0.005`, `12`, `32`, and `0`. `billboard` defaults to `DISABLED` when absent, but any present value other than `0` or `2`, including unparseable strings, silently resolves to `ENABLED` rather than the strict default, with no warning. `horizontal_alignment` warns and falls back to `CENTER` via `intOr` on an unparseable value, then silently re-clamps to `CENTER` a second time if the parsed int falls outside `0`-`3`. `no_depth_test` reads via plain string equality (`=== 'true'`) rather than `boolOr`, so anything but the literal "true" renders false with no warning. `modulate` and `outline_modulate` fall back to opaque white and opaque black on a malformed `Color`, silently, since `parseColor`/`colorOr` never warn.
