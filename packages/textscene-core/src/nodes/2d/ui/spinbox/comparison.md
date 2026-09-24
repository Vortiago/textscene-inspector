---
type: SpinBox
category: 2D
status: unreviewed
fixture: unit-spin-box.tscn
# image: unit-spin-box
renders_as: a LineEdit-style field plus two arrow stepper icons
---

# SpinBox

SpinBox is a numeric text input over a Range, with prefix, suffix and arrow-button
stepping. The previewer draws the internal field's chrome and its formatted value
(`value` snapped to `step`, wrapped in `prefix`/`suffix`), and the up/down arrow icons.
An arrow is dimmed once the value sits at its bound without `allow_greater`/
`allow_lesser`, and both are dimmed once `editable` is false.

## Linting

<!-- lint:begin SpinBox -->
Strict parsing format-checks these `SpinBox` properties, plus 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-3 (HORIZONTAL_ALIGNMENT_LEFT/HORIZONTAL_ALIGNMENT_CENTER/HORIZONTAL_ALIGNMENT_RIGHT/HORIZONTAL_ALIGNMENT_FILL) | error |
| `custom_arrow_round` | true or false |  |
| `custom_arrow_step` | float >= 0 | warning below |
| `editable` | true or false |  |
| `prefix` | quoted string, or the &"…" StringName jacket |  |
| `select_all_on_focus` | true or false |  |
| `suffix` | quoted string, or the &"…" StringName jacket |  |
| `update_on_text_changed` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser reads every property in the table above (plus the inherited `Range`
keys `value`/`min_value`/`max_value`/`step`/`page`/`exp_edit`/`rounded`/`allow_greater`/
`allow_lesser`), so a malformed one is absent from the parsed node.

## Known limitations

- **Not drawn** Hover, pressed and drag draw states for either arrow button: a static
  preview reaches none of them.
- **Not drawn** `up_down_buttons_separator`. Its rect's height is always the
  `buttons_vertical_separation` theme constant (`default_theme.cpp:646`, 0), and this
  codebase models no per-node override for it, so the rect always has zero area.
  `field_and_buttons_separator` is drawn, from this node's `theme_override_styles/*`.
- **Approximated** The internal field is never a scene node: Godot creates it at
  construction (`spin_box.cpp:723-731`). A project Theme entry for its
  `"SpinBoxInnerLineEdit"` type variation reaches the field's font, because this
  previewer walks that scope directly. But its StyleBox always draws the plain
  default-theme LineEdit box. No per-node `theme_override_styles` reaches a node the file
  never serialises, and this codebase resolves a StyleBox override only from a node's own
  `theme_override_styles`, never from an ancestor Theme resource by class name.
