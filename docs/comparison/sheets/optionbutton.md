---
type: OptionButton
category: 2D
fixture: unit-optionbutton.tscn
image: unit-optionbutton
renders_as: a collapsed dropdown div
---

# OptionButton

A dropdown that collapses to show its currently-selected item. Being a static
viewer, the previewer draws only that selected item's text inside a positioned
HTML `<div>` on the Control overlay — not the open popup, not the whole list. The
fixture centres one `DifficultySelect` with three items (`Easy`, `Normal`, `Hard`)
and `selected = 1`, so both renders show `Normal`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `item_count` + `popup/item_N/text` | `3` items: `Easy` / `Normal` / `Hard` | defines the option list; only the selected one is drawn |
| `selected` | `1` | shows `Normal` (the item at index 1) as the button label |

## Divergences

Two, both in the button chrome rather than the label. Godot draws its default-theme
StyleBox as a neutral charcoal with a **dropdown chevron icon at the right edge**;
the previewer draws a lighter, blue-tinted slate fill (`rgba(70,78,94)`) and **no
arrow**. The arrow is a theme icon texture the previewer has no access to (the same
root cause as the CheckBox indicator), so the collapsed affordance reads as a plain
tinted rectangle. The tint difference is the same default-theme chrome synthesis the
Button render shows — this previewer draws its own chrome instead of Godot's charcoal. The
selected-item resolution is correct in both: `selected = 1` picks `Normal`, not the
first item. No PARITY-LIMITATIONS entry covers either the chevron or the default-theme
chrome.
