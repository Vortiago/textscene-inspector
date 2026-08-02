---
type: BaseButton
category: 2D
status: unimplemented
fixture: unit-base-button.tscn
# image: unit-base-button
renders_as: nothing yet — not implemented
---

# BaseButton

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `disabled` | `false` | Format-checked only; the previewer draws nothing regardless. |
| `toggle_mode` | `true` | Format-checked only. |
| `button_pressed` | `false` | Format-checked only. |
| `action_mode` | `1` (`ACTION_MODE_BUTTON_RELEASE`) | Format-checked only. |
| `button_mask` | `1` (Mouse Left) | Format-checked only. |
| `keep_pressed_outside` | `false` | Format-checked only. |
| `button_group` | `SubResource("ButtonGroup_1")` | Format-checked only. |
| `shortcut` | `SubResource("Shortcut_1")` | Format-checked only. |
| `shortcut_feedback` | `true` | Format-checked only. |
| `shortcut_in_tooltip` | `true` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin BaseButton -->
Strict parsing format-checks these `BaseButton` properties, plus 26 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `action_mode` | enum 0-1 (ACTION_MODE_BUTTON_PRESS/ACTION_MODE_BUTTON_RELEASE) |
| `button_group` | SubResource("id") or ExtResource("id") |
| `button_mask` | integer >= 0 |
| `button_pressed` | true or false |
| `disabled` | true or false |
| `keep_pressed_outside` | true or false |
| `shortcut` | SubResource("id") or ExtResource("id") |
| `shortcut_feedback` | true or false |
| `shortcut_in_tooltip` | true or false |
| `toggle_mode` | true or false |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`linterParser.ts` now format-checks all 10 of BaseButton's own members
(everything in `doc/classes/BaseButton.xml` except `focus_mode`, which only
overrides a Control default). None of them affect the rendered fallback
today, since BaseButton draws nothing (ADR-0003): the strict and lenient
parsers still agree on every property, because `parser.ts` reads none of
these keys at all — it reuses `parseControl` unchanged. A property here
becomes render-relevant only once a concrete subclass (Button, CheckBox, …)
reads it for drawing.
