---
type: CheckBox
category: 2D
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: a theme icon followed by a text run
---

# CheckBox

A toggle button that shows a check indicator to the left of its label. The
previewer draws the theme's own indicator texture and then the label, with no
chrome between them — CheckBox's `normal` StyleBox is empty.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Enable Sound"` / `"Disabled Option"` | the label drawn after each indicator |
| `button_pressed` | `true` / `false` | the top row shows a tick; the bottom row's box is empty |
| `disabled` | `true` | dims the "Disabled Option" row's label and box |

## Divergences

The indicator is the theme's own icon texture on both sides. Measured on Godot
4.6.3, `pnpm ref:godot scenes/fixtures/unit-checkbox.tscn --mode 2d --probe <x,y>`
against `pnpm ref:ours unit-checkbox.tscn --2d --probe <x,y>`:

| Probe | What it is | Godot | Ours |
| --- | --- | --- | --- |
| (509, 291) | the checked plate, where Godot draws it | rgb(210, 210, 210) | rgb(76, 76, 76) |
| (509, 294) | the same plate 3 px lower, where ours draws it | rgb(210, 210, 210) | rgb(210, 210, 210) |
| (516, 295) | the tick cut out of that plate | rgb(26, 26, 26) | rgb(210, 210, 210) |

Same texture, same colours, same footprint: the checked icon's ink spans
x 506..519 over 14 rows in both, 190 px against 194. It sits 3 px lower because
the row itself is 3 px taller — `CheckBox::get_minimum_size` floors the row at the
font height, and ours measures that 3 px over (the Control sheet has the
arithmetic), which also moves the tick out from under a probe aimed at Godot's.
The disabled row's unchecked icon lands at x 505..518 in Godot and x 506..519
here, one pixel right.

A scene-authored `theme_override_icons/<name>` is still a separate case:
`parseThemeOverrides` drops it through its `default` branch, where
`theme_override_styles` would resolve it.

## Native (WebGL canvas) painter

`nativeSolver.ts` registers `CheckBox::get_minimum_size`
(`controlSolverRegistry.registerMinimumSize`); `Component.tsx` draws the
check (or radio, when the node belongs to a `button_group`) indicator using the
real vendored icon textures (`native/themeIcons.ts`'s `CHECK_BOX_ICONS`, 8
draw-state variants), followed by the label — CheckBox draws NO chrome mesh at
all, since its own "normal" StyleBox is a `StyleBoxEmpty` (`default_theme.cpp:
276-277`).

### The checked state draws DRAW_PRESSED, not DRAW_NORMAL — a label colour a
### static preview could easily get wrong

`button_pressed = true` makes `BaseButton::get_draw_mode()`
(`scene/gui/base_button.cpp:325-358`) return `DRAW_PRESSED` even with no pointer
ever touching the control (a static preview never sets `hovering`/`press_attempt`,
so the function's own `else` branch collapses to `pressing = status.pressed`).
CheckBox registers its own `font_pressed_color = control_font_pressed_color =
Color(1, 1, 1)` (`default_theme.cpp:108,301`), so a CHECKED, non-disabled row's
label draws pure white — NOT the 0.875-gray `font_color` a merely-normal label
would use.

Measured against real Godot 4.6.3 — `pnpm ref:godot scenes/fixtures/unit-checkbox.tscn
--mode 2d --probe 527,298` (a solid glyph-stroke pixel inside the checked row's
label) → `rgb(255, 255, 255)`. The disabled row's label, by contrast, reads
`rgb(150, 150, 150)` at probe `526,350` — `font_disabled_color` (`{0.875, 0.875,
0.875, 0.5}`, `default_theme.cpp:106,305`) alpha-blended over the `rgb(76,76,76)`
clear colour: `0.5*223 + 0.5*76 = 149.5`. The native painter resolves all three
states (`resolveCheckBoxDrawState`), so the checked row draws white and the
disabled row draws the blended gray, matching both probes exactly.

No pointer-dependent draw gate: the check/radio icon and the label both draw
unconditionally in `CheckBox::_notification`'s `NOTIFICATION_DRAW` — there is no
`mouse_inside`/hover condition to reproduce here, unlike the SplitContainer
grabber's `autohide`.

## Linting

<!-- lint:begin CheckBox -->
Strict parsing format-checks the inherited set (35 inherited from Control); `CheckBox` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
<!-- lint:end -->

CheckBox's own fields, `text`, `button_pressed`, `disabled`, `button_group`, are
unchecked by strict, which only covers the inherited Control set. `button_pressed`
and `disabled` parse with a bare `=== 'true'` check: any non-`"true"` value,
valid-looking or not, silently becomes `false` with no warning. `button_group` is
stored as whatever raw string is present, unparsed and unvalidated.
