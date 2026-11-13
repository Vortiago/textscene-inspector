# Godot's default theme is one table that the theme lookup reads last

- Status: Accepted
- Related: ADR-0071 (a resource is read through the reading module).

## Context

Godot looks a theme item up in the owner Themes, then the project theme, then the default theme
(`scene/main/theme_owner.cpp:227-261`). The default theme is one object that
`scene/theme/default_theme.cpp` fills at the project's `gui/theme/default_theme_scale`. Here each
Control read its items from the scene and project Themes and then fell back to a value of its own:
`n.colors['font_color'] ?? <a copy of Godot's colour>`. The copies were spread over many files. A
type variation such as `FlatButton` or `HeaderSmall` needed its own code to find its base's items,
and a copy that missed the theme scale drew the Control at scale 1.

## Decision

**The default theme is one table that the lookup reads after every scene and project Theme.**

- **One table for each scale.** `defaultThemeAt(scale)` in `godot/scene/defaultTheme/` builds the
  colours, constants, font sizes and StyleBoxes of each type once, and freezes them. A StyleBox is
  plain data (`flat` or `empty`), because `godot/` imports nothing outside `godot/`.
- **The builders take Godot's unscaled values.** `makeFlatStyleBox` and `makeEmptyStyleBox` port
  `make_flat_stylebox` and `make_empty_stylebox`, and round each length as Godot does. A call
  site gives the radius once, and the builder derives the corner detail from it.
- **Godot's own values are the test.** `defaultTheme.godot.json` holds what Godot 4.6.3 reports for
  each item at the scales 1, 1.5 and 2 (`godot/scene/testing/defaultTheme/measure.mjs`). A test
  compares the table with it, item by item.
- **The lookup walks the table last.** `mergeThemedRecord` walks the type chain over the table
  after the scene and project Themes, so a type variation reads its base's items with no extra
  code. `ProjectFonts.defaultTheme` carries the table at the project's scale.
- **A Control reads with no fallback.** It reads `n.colors`, `n.constants` and `n.styleBoxes`.
  An item the table holds is read through `requiredThemeItem`, which throws on a missing table
  entry. A source scan (`defaultThemeFallback.conformance.test.ts`) fails on a `??` fallback for
  an item the table holds, in a Control folder whose types the table holds.
- **A type moves into the table with its Control.** The table holds a type only when its Controls
  read from it. The list of types in the test and the list of folders in the scan grow together.

## Consequences

- A new default item is one line in the table, and the capture test says if it is wrong.
- A change of the theme scale gives a new `ProjectFonts`, so the solve tree builds again with the
  table at that scale.
- `NativeTheme` holds only the scaled metrics. Every box, colour and constant a Control draws
  comes from the table.
- An item that no theme holds reads the fallback theme's value: `Color()` for a colour and 0 for a
  constant.
