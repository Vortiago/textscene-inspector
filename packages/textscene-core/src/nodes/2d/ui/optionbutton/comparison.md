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
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 26 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `OptionButton` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`OptionButton` has no strict counterpart of its own for `selected`, `popup/item_N/id`,
or `disabled`. `selected` goes through the optional-int reader, so an absent or
unparseable value becomes `undefined` and the control renders with empty label text
rather than defaulting to item 0. An invalid `popup/item_N/id` silently falls back
to the item's own loop index, and `disabled` treats any value other than the literal
string `true` as `false`, both with no warning logged.
