---
type: MarginContainer
category: 2D
fixture: unit-margin-container.tscn
image: unit-margin-container
renders_as: a padded flex container
---

# MarginContainer

MarginContainer insets its single child by four theme-override margin constants.
The previewer maps it to a CSS flex box whose padding is those margins, so the
container draws nothing itself — the child's blue fill sits inset by the margins,
and the grey background shows through the padding band.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_right` / `anchor_bottom` | `15` / `1.0` / `1.0` | the container fills the parent Control, so it spans the whole viewport |
| `theme_override_constants/margin_left` · `margin_right` | `32` | wider grey band down the left and right edges of the blue fill |
| `theme_override_constants/margin_top` · `margin_bottom` | `16` | shorter grey band top and bottom — half the horizontal inset |
| child `ColorRect.color` | `Color(0.2, 0.4, 0.8, 1)` | the blue fill occupying the padded box |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin MarginContainer -->
Strict parsing format-checks the inherited set (27 inherited from Control, 15 inherited from CanvasItem, 10 inherited from Node); `MarginContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

MarginContainer's parser adds nothing beyond Control; the four margins are
collected generically as `theme_override_constants` via `parseOptionalFloat`,
which returns `undefined` (no warning) for an absent or unparseable
`margin_left` / `margin_top` / `margin_right` / `margin_bottom`. The Component
then substitutes `0` for whichever margins are `undefined`, so a missing or
garbled constant just removes that side's padding rather than failing.
