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

Three things do differ. Measured on Godot 4.6.3, `pnpm ref:godot
scenes/fixtures/unit-lineedit.tscn --mode 2d --probe <x,y>` against `pnpm
ref:ours unit-lineedit.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (30, 125) | the first of `Secret`'s seven bullets | rgb(223, 223, 223) | rgb(45, 45, 45) |
| (33, 77) | a stroke of `Ada Lovelace`, at Godot's baseline | rgb(223, 223, 223) | rgb(45, 45, 45) |

**The secret echo draws nothing.** Godot paints seven `•` (U+2022) at
x 29..68, y 123..127 — 126 px of ink; the baked MSDF atlas covers printable
ASCII only, so the bullet has no glyph and the field comes out empty. The
plaintext is correctly not drawn, which is the property the fixture exists to
pin, but the echo that replaces it is missing.

**The text sits 5 px too high in its box.** `Ada Lovelace`'s ink starts at row
77 in Godot and row 72 here; `Flat, no stylebox` runs y 206..221 against
y 201..217, with the identical x span 29..153; `Centred` runs y 249..260 against
244..257. The horizontal placement is right — the centred run lands within 2 px
of Godot's — so this is the vertical term of `LineEdit`'s own text offset, not
the shaping.

**Font colour is one sRGB transfer function too dark**, as on every text
Control: the full-colour runs peak at rgb(188, 188, 188) here against Godot's
rgb(223, 223, 223). The Control sheet has the mechanism.

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

### Known, deliberate gap: the default secret bullet has no atlas glyph

`secret`'s substitution logic is exact (`displayText.ts`'s `lineEditDisplayText`,
independently unit-tested), but the vendored Open Sans atlas
(`r3f/controls/native/text/openSansAtlas.ts`) only bakes printable ASCII —
`•` (U+2022), the DEFAULT `secret_character`, is not among them. A secret
field that never overrides `secret_character` therefore echoes a run of
GLYPHS THAT DRAW NOTHING (zero quads, verified in `Component.test.tsx`) —
invisible rather than wrong, but still a gap: an ASCII override (e.g. `*`)
renders correctly. Measured against the engine: Godot puts 126 px of bullet ink
at x 29..68, y 123..127 on this fixture's `Secret` field, ours puts none.
Closing it would mean adding `•` to the baked atlas.

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
