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
of text on the canvas — whichever string Godot's `_shape()` would paint, in
whichever colour that string's state calls for. Being a static viewer, it
renders no caret, no selection and no clear button.

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

Glyphs match. Both sides shape the same bundled Open Sans, and the six fields
land on the same rows: measured with `pnpm ref:godot
scenes/fixtures/unit-lineedit.tscn --mode 2d --out …` against `pnpm ref:ours
unit-lineedit.tscn --2d --out …`, every box spans 31 px starting at y 24 / 67 /
110 / 153 / 196 / 239 on both sides, and `Ada Lovelace`'s ink runs x 28..128 in
Godot and x 28..128 here. So field HEIGHT and minimum WIDTH are no longer
approximations — the fields are the same size, exercised through a
`VBoxContainer` that gives them none.

The previewer draws no caret. That is not an approximation but the same
condition Godot evaluates: `LineEdit::_validate_caret_can_draw()` sets
`caret_can_draw` from `caret_force_displayed` or from the node *editing* while
holding focus, and a static preview has neither — so a caret would be the
divergence.

Both of the things that used to differ here are now closed; what is left is one
probe landing on an antialiased stroke edge. Measured on Godot 4.6.3, `pnpm ref:godot
scenes/fixtures/unit-lineedit.tscn --mode 2d --probe <x,y>` against `pnpm
ref:ours unit-lineedit.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (30, 125) | the first of `Secret`'s seven bullets — CLOSED, see below | rgb(223, 223, 223) | rgb(223, 223, 223) |
| (33, 77) | a stroke of `Ada Lovelace`, at Godot's baseline — unmoved by the advance-drift fix below, see why | rgb(223, 223, 223) | rgb(128, 128, 128) |

**CLOSED: the secret echo now draws.** Previously the baked MSDF atlas covered
printable ASCII only, so the DEFAULT `secret_character` — `•` (U+2022) — had no
glyph and the field came out empty (BEFORE: Godot 126 px of bullet ink at
x 29..68, y 123..127; ours drew none, probe (30, 125) read rgb(45, 45, 45), the
background). The atlas now bakes `•` (`scripts/fonts/bake-metrics.mjs`'s
`EXTRA_CODEPOINTS`, cited to `line_edit.cpp:3094`'s own default), and the
echo draws (AFTER, this fixture: Godot's bullet ink spans x 29..68,
y 123..127; ours spans x 29..68, y 124..128 — a 1 px vertical residual at the
ink's faint edge only, described under the native painter below; probe
(30, 125) now reads rgb(223, 223, 223) on both sides).

That (33, 77) row is the one probe in this table that still parts. It reads
rgb(128, 128, 128) here against Godot's rgb(223, 223, 223) — a half-covered
pixel at a stroke edge, not the background it used to read, so the glyph is
present and its run sits on Godot's rows (y 77..88 on both sides).

This probe does NOT move with the RichTextLabel sheet's whole-line
advance-drift fix (`openSansMetrics.ts`'s continuous per-glyph
`advanceWidths`, replacing the atlas-bake-resolution-42-rounded `xadvance` as
the shaping source) — measured directly, before and after, it reads the exact
same rgb(128, 128, 128). That is expected, not a miss: `Ada Lovelace`'s ink
already spanned x 28..128 on both sides before this fix (`widthPx` matched to
the pixel), so there was no accumulated drift left to close on THIS field by
the time the fix landed, and (33, 77) sits on the very FIRST glyph ('A' of
'Ada') — a position with zero accumulated advance ahead of it regardless.
Dumping the raw pixels around it (`y=7`-relative rows through the apex of
'A') shows Godot's own peak arriving one row earlier than ours at that exact
column — a difference in how the apex's own antialiasing falls across pixel
rows, not a horizontal pen-position error. Left open; not the same defect the
RichTextLabel sheet closed.

**CLOSED — the text sits on Godot's own rows.** It used to sit 5 px too high.
Every run in the fixture now matches to the pixel:

| Run | Godot | Ours, before | Ours, now |
| --- | --- | --- | --- |
| `Ada Lovelace` | y 77..88 | starts at row 72 | y 77..88 |
| the secret echo | y 124..127 | drew nothing at all | y 124..127 |
| `Flat, no stylebox` | y 206..221 | y 201..217 | y 206..221 |
| `Centred` | y 249..260 | y 244..257 | y 249..260 |

The horizontal placement was already right, which localised it to the vertical
term of `LineEdit`'s own text offset rather than the shaping. `line_edit.cpp`'s
`int y_ofs = style->get_offset().y + (y_area - text_height) / 2` adds the ACTIVE
style's TOP margin — `StyleBox::get_offset()` is
`Point2(get_margin(SIDE_LEFT), get_margin(SIDE_TOP))` — and that term was
missing here entirely, as was the truncation of the sum toward zero.

**CLOSED — font colour lands on Godot's value**, as on every text Control: the
full-colour runs peak at rgb(223, 223, 223) on both sides now, where they used
to peak at rgb(188, 188, 188). The Control sheet has the mechanism.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `LineEdit::get_minimum_size` (`controlSolverRegistry.registerMinimumSize`,
`line_edit.cpp:2443-2477`) — the exact `minimum_character_width * 'W'-advance`
term, measured against the SAME vendored Open Sans atlas Godot's own default
theme font is baked from. `Component.tsx` draws the `normal`/`read_only` `StyleBoxQuad`
(skipped when `flat`) and one `<TextRun>` — whichever string
`lineEditDisplayText` selects, at `font_color`/`font_uneditable_color`/
`font_placeholder_color` per state, aligned per `alignment`, and clipped to
the content rect (the rect inset by the ACTIVE stylebox's margins) the same
way `ScrollContainer` (packet P16) clips its own subtree, just for this one
run rather than a whole descendant tree. `nativeTheme.ts` gained LineEdit's
own `normal`/`read_only` StyleBoxFlat structs (`widgets.lineEdit`) as part of
this packet — no earlier packet needed them. As with every native painter
shipped so far, this is a static-viewer draw: no caret, no selection, no IME.

### CLOSED: the default secret bullet now has an atlas glyph

`secret`'s substitution logic was always exact (`displayText.ts`'s
`lineEditDisplayText`, independently unit-tested) — the gap was purely that
the vendored Open Sans atlas only baked printable ASCII, so `•` (U+2022), the
DEFAULT `secret_character`, had no entry: a secret field that never overrides
`secret_character` echoed a run of glyphs that drew zero quads, invisible
rather than wrong, but still a gap (an ASCII override like `*` always
rendered correctly). `scripts/fonts/bake-metrics.mjs` now bakes `•` (cited to
`line_edit.cpp:3094`'s own default), closing it: Godot's 126 px of bullet ink
at x 29..68, y 123..127 on this fixture's `Secret` field is now matched by
ours, x 29..68, y 124..128 — a 1 px vertical residual on the glyph itself, not
on the box's text offset, which is closed and puts all four of this fixture's
runs on Godot's exact rows. It is visible only at the ink's faint edge: at a
threshold that takes the glyph's core, both sides read y 124..127 exactly. That
makes it a glyph-origin term (where a baked glyph's own `yoffset` anchors
against the line box), the same family as the whole-line advance drift the
RichTextLabel sheet records, and not a bullet-specific gap.

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
