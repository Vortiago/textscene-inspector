---
type: OptionButton
category: 2D
fixture: unit-optionbutton.tscn
image: unit-optionbutton
renders_as: a collapsed dropdown box
---

# OptionButton

A dropdown that collapses to show its currently-selected item. Being a static
viewer, the previewer draws that selected item's text inside the button's own
StyleBox — not the open popup, not the whole list. The fixture centres one
`DifficultySelect` with three items and `selected = 1`, so both renders show
`Normal` in a dark charcoal rounded box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `item_count` + `popup/item_N/text` | `3` items: `Easy` / `Normal` / `Hard` | defines the option list; only the selected item is drawn |
| `selected` | `1` | draws `Normal` (the item at index 1), not the first item |
| `offset_left/right/top/bottom` | `-75 / 75 / -24 / 8` | sizes the 150x32 button, centred by the `anchors_preset = 8` anchors |

## Divergences

The chevron is drawn. Measured on Godot 4.6.3, `pnpm ref:godot
scenes/fixtures/unit-optionbutton.tscn --mode 2d --probe <x,y>` against
`pnpm ref:ours unit-optionbutton.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (641, 317) | the chevron's stroke | rgb(158, 158, 158) | rgb(152, 152, 152) |
| (511, 310) | a stroke of the `Normal` label | rgb(223, 223, 223) | rgb(104, 104, 104) |

The arrow's ink covers exactly 42 px in x 636..645 on both sides and peaks at
rgb(158, 158, 158) against rgb(157, 157, 157) — the same texture at the same
`arrow_margin`. It sits one row lower here (y 314..319 against 313..318) because
the box is 34 px tall against Godot's 32, and the chevron is centred in it.

Two things still differ, both shared with every other widget sheet:

- **The box grows past its authored rect.** The fixture's offsets make it 150x32
  and Godot keeps that (y 300..331); ours is y 300..333, floored by a minimum
  height that measures the font 3 px too tall. See the Control sheet.
- **The label is too dark**: rgb(188, 188, 188) at its peak against Godot's
  rgb(223, 223, 223), the sRGB-encode gap the Control sheet measures. The probe
  above reads a lower pair only because the two labels sit one row apart.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `OptionButton::get_minimum_size`
(`controlSolverRegistry.registerMinimumSize`, honouring `fit_to_longest_item`'s
engine default of `true` — the minimum size floors on the WIDEST item's text,
not the selected one's); `Component.tsx` draws the Button-style StyleBox
chrome, the SELECTED item's text only (never the popup's full list), and the
chevron (`native/themeIcons.ts`'s `OPTION_BUTTON_ICONS.arrow`) at the right
edge.

### The chevron sits at `arrow_margin`, not the content-margin edge

OptionButton's own `_notification` positions the arrow directly against the
FULL control size and its own `arrow_margin` theme constant
(`option_button.cpp:113-121`; `default_theme.cpp:249`, `round(4*scale) = 4` at
scale 1) — NOT the stylebox's content margin (8px horizontal,
`default_theme.cpp:212-215`, already `theme.optionButtonMarginX` in
`godotDefaultTheme.ts`) the text box narrows against. The two numbers are
independent and, in the default theme, different.

Measured against real Godot 4.6.3 — `pnpm ref:godot
scenes/fixtures/unit-optionbutton.tscn --mode 2d`: the 150×32 button's box fill
(`rgb(46,46,46)`) extends flush to its rightmost pixel (probe `649,316` → fill,
`651,316` → the `rgb(76,76,76)` backdrop, i.e. the box's own right edge), while
the chevron's own ink sits at probe `641,316` (`rgb(148,148,148)`, a partial-
coverage sample of the `#b2b2b2`-stroke SVG) — `150 - 12(arrow width) -
4(arrow_margin) = 134` in from the left, not `150 - 12 - 8`. `modulate_arrow`
defaults `false` (`:251`), so `NOTIFICATION_DRAW` never enters the font-colour
switch at all and the chevron always draws opaque white, unaffected by
`disabled`/state — the native painter models exactly that (no per-state arrow
tint).

No pointer-dependent draw gate: the chevron's own draw condition
(`has_theme_icon("arrow")`) is unconditionally true in the default theme, with
no `mouse_inside`/hover check — unlike the SplitContainer grabber's `autohide`.

## Linting

<!-- lint:begin OptionButton -->
Strict parsing format-checks the inherited set (33 inherited from Control); `OptionButton` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`OptionButton` has no strict counterpart of its own for `selected`, `popup/item_N/id`,
or `disabled`. `selected` goes through the optional-int reader, so an absent or
unparseable value becomes `undefined` and the control renders with empty label text
rather than defaulting to item 0. An invalid `popup/item_N/id` silently falls back
to the item's own loop index, and `disabled` treats any value other than the literal
string `true` as `false`, both with no warning logged.
