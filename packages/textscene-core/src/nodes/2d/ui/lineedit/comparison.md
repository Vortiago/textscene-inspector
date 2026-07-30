---
type: LineEdit
category: 2D
status: unreviewed
fixture: unit-lineedit.tscn
# image: unit-lineedit
renders_as: a single-line text box
---

# LineEdit

A single-line text field. The previewer draws its stylebox and one clipped run
of text on the Control overlay — whichever string Godot's `_shape()` would
paint, in whichever colour that string's state calls for. Being a static
viewer, it renders no caret, no selection and no clear button.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `placeholder_text` | `Enter text here...` | drawn dimmed on `Placeholder`, which sets no `text` |
| `text` | `Ada Lovelace` on `Filled` | replaces the placeholder entirely and draws at full font colour |
| `secret` | `true` on `Secret` | echoes `hunter2` as seven bullets instead of the plaintext |
| `editable` | `false` on `ReadOnly` | swaps the `normal` stylebox for the fainter `read_only` one and dims the text |
| `flat` | `true` on `Flat` | drops the stylebox, leaving text on the bare panel |
| `alignment` | `1` on `Centred` | centres the run in the box instead of left-aligning it |
| `theme_override_constants/separation` | `12` | the gap between the six fields |

## Divergences

Glyphs do not match: Godot bundles Open Sans SemiBold and the overlay is
restricted to system fonts (ADR-0003), so the two renders differ in letterform,
advance widths and therefore the field's own minimum width. Colour, stylebox
fill, corner radius, the 2px bottom border and which string is painted all
match.

The previewer draws no caret. That is not an approximation but the same
condition Godot evaluates: `LineEdit::_validate_caret_can_draw()` sets
`caret_can_draw` from `caret_force_displayed` or from the node *editing* while
holding focus, and a static preview has neither — so a caret would be the
divergence.

Field height is left to the text's own line box rather than to Godot's
`MAX(shaped text height, font->get_height(font_size))` plus the stylebox
margins, so a field can be a pixel or two off Godot's height even where the box
art matches.

The minimum WIDTH is approximate. `LineEdit::get_minimum_size()` floors it at
`minimum_character_width * font->get_char_size('W', font_size).x` — four times
the font's 'W' advance — and CSS has no unit addressing a specific glyph's
advance, so the previewer substitutes `4em`. For the default font, whose 'W'
advance is about 0.94em, that runs a few percent wide. It only shows on a field
that gets no width from a container or from its own offsets; anywhere else the
laid-out width exceeds the floor and the substitution is invisible.

## Linting

<!-- lint:begin LineEdit -->
Strict parsing format-checks the inherited set (33 inherited from Control); `LineEdit` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`LineEdit` has no strict counterpart for `secret_character`, `alignment` or
`flat`. `alignment` goes through the optional-int reader, so a non-numeric value
becomes `undefined` and the field left-aligns rather than reporting the bad
enum; an `alignment` outside 0..3 also silently reads as left. `secret` and
`flat` treat any value other than the literal string `true` as `false`, with
nothing logged. An empty `secret_character` falls back to the bullet rather than
erasing the echo, matching Godot but hiding the authoring mistake.
