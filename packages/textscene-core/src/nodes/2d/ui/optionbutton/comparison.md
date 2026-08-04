---
type: OptionButton
category: 2D
fixture: unit-optionbutton.tscn
image: unit-optionbutton
renders_as: a collapsed dropdown box
---

# OptionButton

A dropdown that collapses to show its currently-selected item. Being a static
viewer, the previewer draws that selected item's text inside a positioned HTML
box on the Control overlay — not the open popup, not the whole list. The fixture
centres one `DifficultySelect` with three items and `selected = 1`, so both
renders show `Normal` in a dark charcoal rounded box.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `item_count` + `popup/item_N/text` | `3` items: `Easy` / `Normal` / `Hard` | defines the option list; only the selected item is drawn |
| `selected` | `1` | draws `Normal` (the item at index 1), not the first item |
| `offset_left/right/top/bottom` | `-75 / 75 / -24 / 8` | sizes the 150x32 button, centred by the `anchors_preset = 8` anchors |

## Divergences

Godot draws a right-side chevron arrow icon inside the box; the previewer draws
none. The arrow is a default-theme icon texture outside the fill/radius/padding
chrome the previewer synthesises, so the collapsed affordance ends at the label.
The box fill (dark charcoal ~rgb(46,46,46)), corner radius, padding, font, and the
`Normal` label otherwise match.

## Linting

<!-- lint:begin OptionButton -->
Strict parsing format-checks these `OptionButton` properties, plus 13 inherited from Button, 10 inherited from BaseButton, 27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `allow_reselect` | true or false |
| `fit_to_longest_item` | true or false |
| `item_count` | integer >= 0 |
| `popup/item_#/*` | popup/item_<index>/<leaf> (see option_button.cpp:628-632, PropertyListHelper-backed) |
| `selected` | integer >= -1 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
| `valid-optionbutton-selected` | `optionbutton-selected-out-of-range` | warning |
<!-- lint:end -->

The table above predates this section and still reads "`OptionButton` declares
none of its own"; it is the generated `lint:begin`/`lint:end` block and is now
stale, needing a regen once that can run without racing concurrent slice work.

`OptionButton` now has a strict counterpart for every own property: `selected`,
`fit_to_longest_item`, `allow_reselect`, `item_count`, and the
`popup/item_N/{text,icon,id,disabled,separator}` family (linterParser.ts). The
lenient render path above is unaffected by that: an absent or unparseable
`selected` still becomes `undefined` and the control renders empty label text
rather than defaulting to item 0, and an invalid `popup/item_N/id` still falls
back to the item's own loop index: the lenient parser renders what it can
regardless of what strict mode would reject on the same file.

`popup/item_N/id`'s floor (0) is a warning, not an error: `PROPERTY_HINT_RANGE
"0,10,1,or_greater"` only hints it, and the value is assigned straight through
to the underlying item (option_button.cpp:630, forwarding to PopupMenu's
`set_item_id`). `selected`'s floor (-1, "none selected") IS an error: below it,
`_select_int` returns without assigning (option_button.cpp:433), a silently
dropped write. A cross-field rule (linter.ts) additionally warns when
`selected` names an index `item_count` never provides, a bound neither
property's own validator can see on its own.

`text` and `icon` are Button's, not OptionButton's own: `_validate_property`
(option_button.cpp:554-558) hides them from the inspector/saver, but Button's
setters still accept a hand-written value (inert, not invalid: the value is
simply overwritten the next time a selection is applied), so both resolve
through the inherited Button validator rather than being flagged unavailable.
