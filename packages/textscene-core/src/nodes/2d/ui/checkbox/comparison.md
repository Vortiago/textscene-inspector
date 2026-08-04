---
type: CheckBox
category: 2D
fixture: unit-checkbox.tscn
image: unit-checkbox
renders_as: an inline HTML row with a drawn check indicator
---

# CheckBox

A toggle button that shows a check indicator to the left of its label. The
previewer draws it in the Control overlay as an inline row: a small square
indicator followed by the label text.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `text` | `"Enable Sound"` / `"Disabled Option"` | the label drawn after each indicator |
| `button_pressed` | `true` / `false` | the top row shows a tick; the bottom row's box is empty |
| `disabled` | `true` | dims the "Disabled Option" row's label and box |

## Divergences

The indicator's fill. Godot draws the theme's icon textures — a bright, solid
square with a tick for the checked row, a gray solid square for the unchecked,
disabled one — while the previewer draws a thin outlined square with a Unicode
tick when checked and an empty outline when not. Godot's default-theme icons are
compiled into the engine rather than shipped as resource files, so the indicator is
a drawn approximation. A scene-authored `theme_override_icons/<name>` is a separate
case: `parseThemeOverrides` drops it through its `default` branch, but it would
resolve the way `theme_override_styles` already does. The checked/unchecked distinction and the dimmed disabled row
read correctly in both, and the labels sit at the same place.
**Closed by the native (WebGL) painter below**, which draws the actual vendored
icon textures instead of a hand-drawn approximation — see its own section.

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
Strict parsing format-checks the inherited set (33 inherited from Control); `CheckBox` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

CheckBox's own fields, `text`, `button_pressed`, `disabled`, `button_group`, are
unchecked by strict, which only covers the inherited Control set. `button_pressed`
and `disabled` parse with a bare `=== 'true'` check: any non-`"true"` value,
valid-looking or not, silently becomes `false` with no warning. `button_group` is
stored as whatever raw string is present, unparsed and unvalidated.
