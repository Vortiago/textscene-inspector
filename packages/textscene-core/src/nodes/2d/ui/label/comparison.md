---
type: Label
category: 2D
fixture: unit-label-2d.tscn
image: unit-label-2d
renders_as: a shaped text run on the canvas
---

# Label

Label is the 2D UI text node. The previewer draws the string on the canvas. It shapes the string in
the font, size, colour, line spacing and paragraph spacing of `label_settings`, which override the theme
outright. Without `label_settings`, it shapes in the theme's font and reads the `line_spacing` and
`paragraph_spacing` theme constants, which the node's `theme_override_constants` and the Theme chain
resolve. A paragraph adds its spacing once, after its last shown line: a line that autowrap breaks
inside a paragraph does not.

A FILL Label fits the lines of each paragraph on its own (`label.cpp:272-319`). The last line of each
paragraph stays unfitted under the default flags, and a single-line paragraph is fitted.

A Label draws its layers in Godot's order (`label.cpp:828-883`). The shadow ring and the shadow come first. Then
each stacked shadow and each stacked outline draw from the last index to the first. The outline comes next, and the fill
comes last. A ring is a stroked contour with a one-sided radius of `outline_size / 4` px (`text_server_adv.cpp:1383`).
It draws on the canvas painter for the bundled font and a scene font alike (ADR-0040). The fill and the plain shadows
draw on the painter their font takes.
An embolden over the bundled font draws on the canvas painter, which emboldens the outline as
FreeType does (`text_server_adv.cpp:1313-1316`, ADR-0040).

A `label_settings.font` resolves in the file that wrote the settings. A font that is loading draws
nothing (`label.cpp:112`, ADR-0059).

A Label whose themes name no font draws the project's `gui/theme/custom_font`, as Godot does
(`theme_db.cpp`, `default_theme.cpp:1371-1373`). A path that does not load keeps the bundled font,
with a warning and a missing-resource row. A BMFont (`.fnt`, `.font`) works in all of those places (ADR-0064).
A descriptor or page that fails to load gives a missing-resource row and keeps the bundled font. It honours the alignment, case, wrap, line-window and
partial-reveal settings.

## BMFont

<!-- compare: image=unit-label-bmfont status=limitation fixture=unit-label-bmfont.tscn -->

A `.fnt` or `.font` font draws each glyph as a rectangle of its page image (`text_server_adv.cpp:4072-4108`).
The size scales it from the fixed size. The scene shows fixed size, double, one and a half times, a
`font_color` tint and a missing glyph, which draws a hex-code box.

## BMFont outline

<!-- compare: image=unit-label-bmfont-outline status=done fixture=unit-label-bmfont-outline.tscn -->

A BMFont with an outline set draws it behind the fill for every `outline_size` above 0. A fixed-size
font caps the outline size at 1 for its cache (`text_server_adv.h:406-414`), so the ring scales with the
glyph, not with `outline_size`.

## BMFont scaling

<!-- compare: image=unit-label-bmfont-scaling status=done fixture=unit-label-bmfont-scaling.tscn -->

The import sidecar's `scaling_mode` sets how a size off the fixed size scales the glyphs
(`text_server_adv.cpp:4093-4104`). Integer rounds the ratio, and Disabled keeps the fixed size.

## Font fallbacks

<!-- compare: image=unit-label-font-fallbacks status=done fixture=unit-label-font-fallbacks.tscn -->

A character the font lacks draws from the first font of its **Fallback chain** that has it, with that
font's advance and kerning (`text_server_adv.cpp:7111-7170`). The chain is the font's `fallbacks`, a font
import's `fallbacks` (`resource_importer_dynamic_font.cpp:192`, `resource_importer_bmfont.cpp:98`), or
the base's for a `FontVariation` with none (`font.cpp:2926-2945`). A BMFont keeps its import's `fallbacks`
as the re-imported state holds them (ADR-0064). The `label-font-fallbacks` golden pins this.

## Decomposed marks

<!-- compare: image=unit-label-decomposed-marks status=done fixture=unit-label-decomposed-marks.tscn -->

A precomposed character the font lacks draws as its base and marks in that font, not in a fallback. The font
needs the pieces of its canonical decomposition (`hb-ot-shape-normalize.cc`). The marks sit at the
offsets of the font's `GPOS` mark lookups. A line rises to a mark above the font's ascent and
sinks to one below its descent (`text_server_adv.cpp:5161-5162`). A font with no `GPOS` script has its marks placed against the ink of the base (`hb-ot-shape-fallback.cc`). A `GPOS` with no mark lookup leaves each mark at its pen position. The `label-decomposed-marks` golden pins all three.

## Variable fonts

<!-- compare: image=unit-label-font-variation-instance status=done fixture=unit-label-font-variation-instance.tscn -->

A `FontVariation` over a variable font draws the instance that its `variation_opentype` names, as Godot sets
the axes on FreeType and HarfBuzz (`text_server_adv.cpp:1915-1950`). The glyphs fill and stroke from the outlines
at the instance. They follow the `fvar`, `avar`, `gvar` and `cvar` tables. Each advance follows `HVAR`, or the
phantom points that `gvar` moves in a font without `HVAR`. The pair kerning follows the `GPOS` `kern` feature
with its deltas at the instance. A `FontVariation` over another takes its own axis values alone (`font.cpp:3120-3131`).

## Kerning at a variable-font instance

<!-- compare: image=unit-label-font-variation-kerning status=done fixture=unit-label-font-variation-kerning.tscn -->

Recursive at `MONO` 0.5 kerns each pair by half its kerning at the default instance, as Godot does.
A `GPOS` `FeatureVariations` record that gives the `kern` feature other lookups at the instance changes the pairs too, as `instanceGposVariations.test.ts` measures against Godot.

## Glyph swaps at a variable-font instance

<!-- compare: image=unit-label-font-variation-glyph-swap status=done fixture=unit-label-font-variation-glyph-swap.tscn -->

The `rvrn` feature of a font's `GSUB` `FeatureVariations` swaps glyphs at some axis values. Recursive draws the mono forms of `f`, `g`, `i`, `l` and `0` at `MONO` 1. It draws the slanted forms of `a`, `g`, `i` and `z` at `slnt` -15. The glyph of each character matches Godot's for every character and instance measured.

## Linting

<!-- lint:begin Label -->
Strict parsing format-checks these `Label` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autowrap_mode` | enum 0-3 (AUTOWRAP_OFF/AUTOWRAP_ARBITRARY/AUTOWRAP_WORD/AUTOWRAP_WORD_SMART) | warning |
| `autowrap_trim_flags` | bit mask of BREAK_TRIM_INDENT (32) \| BREAK_TRIM_START_EDGE_SPACES (64) \| BREAK_TRIM_END_EDGE_SPACES (128) |  |
| `clip_text` | true or false |  |
| `ellipsis_char` | quoted string (or the &"…" StringName or NodePath("…") it converts), at most one character |  |
| `horizontal_alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `justification_flags` | bit mask of JUSTIFICATION_KASHIDA (1) \| JUSTIFICATION_WORD_BOUND (2) \| JUSTIFICATION_AFTER_LAST_TAB (8) \| JUSTIFICATION_SKIP_LAST_LINE (32) \| JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) \| JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128) |  |
| `label_settings` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `language` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `lines_skipped` | integer 0-999 | error below, warning above |
| `max_lines_visible` | integer -1-999 | warning |
| `paragraph_separator` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `structured_text_bidi_override` | enum 0-6 (STRUCTURED_TEXT_DEFAULT/STRUCTURED_TEXT_URI/STRUCTURED_TEXT_FILE/STRUCTURED_TEXT_EMAIL/STRUCTURED_TEXT_LIST/STRUCTURED_TEXT_GDSCRIPT/STRUCTURED_TEXT_CUSTOM) | warning |
| `structured_text_bidi_override_options` | Array literal ([...] or Array[T]([...])) |  |
| `tab_stops` | PackedFloat32Array(x, y, …) |  |
| `text` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `text_direction` | enum 0-3 (TEXT_DIRECTION_AUTO/TEXT_DIRECTION_LTR/TEXT_DIRECTION_RTL/TEXT_DIRECTION_INHERITED) | error below -1, warning below 0, error above 3 |
| `text_overrun_behavior` | enum 0-6 (OVERRUN_NO_TRIMMING/OVERRUN_TRIM_CHAR/OVERRUN_TRIM_WORD/OVERRUN_TRIM_ELLIPSIS/OVERRUN_TRIM_WORD_ELLIPSIS/OVERRUN_TRIM_ELLIPSIS_FORCE/OVERRUN_TRIM_WORD_ELLIPSIS_FORCE) | warning |
| `uppercase` | true or false |  |
| `vertical_alignment` | enum 0-3 (VERTICAL_ALIGNMENT_TOP/VERTICAL_ALIGNMENT_CENTER/VERTICAL_ALIGNMENT_BOTTOM/VERTICAL_ALIGNMENT_FILL) | error |
| `visible_characters` | integer -1-128000 | warning |
| `visible_characters_behavior` | enum 0-4 (VC_CHARS_BEFORE_SHAPING/VC_CHARS_AFTER_SHAPING/VC_GLYPHS_AUTO/VC_GLYPHS_LTR/VC_GLYPHS_RTL) | warning |
| `visible_ratio` | float 0-1 | warning |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-label-autowrap-sizing` | `label-autowrap-needs-custom-minimum-size` | warning |
<!-- lint:end -->

The lenient parser reads these properties:

- `text`, `uppercase`, `label_settings`, `language` and `text_direction`.
- `horizontal_alignment`, `vertical_alignment`, `justification_flags` and `tab_stops`.
- `autowrap_mode`, `autowrap_trim_flags`, `paragraph_separator`, `lines_skipped` and
  `max_lines_visible`.
- `text_overrun_behavior`, `clip_text` and `ellipsis_char`.
- `visible_characters`, `visible_ratio` and `visible_characters_behavior`.
- `structured_text_bidi_override` and `structured_text_bidi_override_options`.

An out-of-range `text_direction` becomes AUTO. An out-of-range or unparseable alignment becomes
`undefined` with no warning. `uppercase` turns on only for a value
that reads as `true`. `ellipsis_char` keeps only its first character, and a malformed
`tab_stops` literal leaves tab stops unset.

`visible_characters` and `visible_ratio` derive each other as
`Label::set_visible_characters`/`set_visible_ratio` do (label.cpp:1285-1327). Whichever
the scene writes last, in file order, wins outright. Each setter's guard is
`if (this_field != new_value)`, and the earlier setter already left the field at the
value the later write matches. The parser replays both writes in file order against
Label's construction defaults. It assumes that `text`, whose length is the denominator,
is already applied. Every real Godot save guarantees that, since `text` is the first
`ADD_PROPERTY`, but a hand-edited file that writes `text` after either does not.

Every count counts code points, as Godot's `String` does (`label.cpp:1375-1377`): the
denominator, the cut at VC_CHARS_BEFORE_SHAPING (`:155-156`) and the budget of
VC_CHARS_AFTER_SHAPING (`label.h:207`). An astral character, such as an emoji, counts one. The
previewer draws no colour emoji, so only the letters after it show the count.

## Text direction

Each paragraph runs the Unicode bidirectional algorithm, as Godot's text server runs ICU over it:

- `text_direction` sets the paragraph direction (`label.cpp:178-181`). INHERITED takes the
  Label's layout direction. AUTO takes the first strong character, else the direction of
  `language`, else of the project's test locale (`text_server_adv.cpp:534-541,7231-7256`).
- `language` also sets the rules of `uppercase` (`label.cpp:139,153`).
- `structured_text_bidi_override` splits each paragraph into ranges (`label.cpp:195`,
  `text_server.cpp:2140-2290`). Each range runs its own bidirectional pass, and the ranges stay in
  logical order left to right (`text_server_adv.cpp:7258-7300`). A character outside every range
  has no glyph, as the first part of a LIST. CUSTOM needs a script, so it gives no range.
- Each line reorders on its own after the line break (`text_server_adv.cpp:5350-5420`), and a
  character at an odd level draws its mirrored pair.
- An astral character, such as an Adlam letter, takes its own direction. ICU reads its surrogate
  pair as one code point.
- FILL with autowrap puts the lines of a right-to-left paragraph at the right edge
  (`label.cpp:472-478`). LEFT, CENTER and RIGHT read the layout direction only.
- With autowrap off, FILL trims a line only when its spaces cannot shrink to fit
  (`OVERRUN_JUSTIFICATION_AWARE`, `label.cpp:322-324`, `text_server_adv.cpp:5947`). The kept spaces
  then grow until the ellipsis ends at the box edge (`JUSTIFICATION_CONSTRAIN_ELLIPSIS`,
  `label.cpp:325`, `text_server_adv.cpp:5573-5583`).
- The overrun trim of a right-to-left line keeps its logical start and draws the ellipsis at
  the visual left (`text_server_adv.cpp:6053-6067`, `label.h:198-241`).

## Known limitations

- **Not drawn** Arabic letters draw in their isolated forms, since the shaper does not join them.
- **Approximated** At an instance, a variable font swaps glyphs by `rvrn` for each character alone, so its ligatures and contextual alternates keep the `cmap` glyphs (#1393).
- **Approximated** At an instance, the `GPOS` kerning reads the pair lookups of every script, where Godot reads those of each script run.
- **Approximated** At an instance, the `GPOS` kerning reads the default language system of each script, where Godot reads the system of the text's language.
- **Approximated** At an instance, the `GPOS` kerning pairs adjacent characters only, where Godot also kerns across a glyph that a lookup flag skips.
- **Approximated** A scene font's glyphs draw with the browser's hinting, not FreeType's light
  hinting (`font.h:203`, `text_server_adv.cpp:1276-1277`), so a cap can sit 1 px lower here.
- **Approximated** A base and a combining mark typed as two characters keep their own pens, with no `GPOS` mark offset (#1393).
- **Approximated** A wrapping Label inside a ScrollContainer can read one line short when
  the wrap is what makes the scrollbar appear.
- **Not drawn** `BREAK_TRIM_INDENT` (an `autowrap_trim_flags` bit): a wrapped
  continuation line does not reserve the leading tab/space indent Godot re-applies to it.
- **Not drawn** The doubled-backslash escapes of `paragraph_separator`, so a literal
  `"\\n"` stays two characters where Godot's `String::c_unescape()` (label.cpp:158) makes
  it a newline.
- **Not drawn** The line-count clamp of `get_layout_data` (label.cpp:533-548), so text
  taller than the rect overflows it here, where Godot drops the lowest lines.
- **Not drawn** A right-to-left script in the bundled font, whose atlas has no such glyph.
