---
type: BaseButton
category: 2D
status: unreviewed
fixture: unit-base-button.tscn
# image: unit-base-button
renders_as: nothing of its own
---

# BaseButton

BaseButton is the base of every clickable Control and draws nothing of its own — Godot's
own `BaseButton::_notification` handles only accessibility/mouse/focus, never
`NOTIFICATION_DRAW`; a concrete descendant like `Button` is what draws. Its
`disabled`/`toggle_mode`/`button_pressed`/… interaction state is real, but has no chrome
of BaseButton's own to affect, so the previewer's native painter is registered but
empty, and its children still show.

## Linting

<!-- lint:begin BaseButton -->
Strict parsing format-checks these `BaseButton` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `action_mode` | enum 0-1 (ACTION_MODE_BUTTON_PRESS/ACTION_MODE_BUTTON_RELEASE) | warning |
| `button_group` | null, SubResource("id") or ExtResource("id") |  |
| `button_mask` | integer |  |
| `button_pressed` | true or false |  |
| `disabled` | true or false |  |
| `keep_pressed_outside` | true or false |  |
| `shortcut` | null, SubResource("id") or ExtResource("id") |  |
| `shortcut_feedback` | true or false |  |
| `shortcut_in_tooltip` | true or false |  |
| `toggle_mode` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all ten of BaseButton's own members. The lenient parser
reuses `parseControl` unchanged and reads none of them, so a bad `toggle_mode` or
`button_group` is neither substituted nor warned on.
