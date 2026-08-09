---
type: CenterContainer
category: 2D
fixture: unit-center-container.tscn
image: unit-center-container
renders_as: a rect centred inside its own
---

# CenterContainer

CenterContainer places its single child at the exact center of its own rect,
horizontally and vertically. The container draws nothing itself — only the centred child shows.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | fills the parent Control (full rect), so the container's center is the viewport center |
| `anchor_right` / `anchor_bottom` | `1.0` | the container spans the full viewport width and height |
| child `Label.text` | `"Centered"` | the single child; the container pins it dead-center |

## Divergences

None visible in this fixture. `pnpm ref:godot
scenes/fixtures/unit-center-container.tscn --mode 2d` against `pnpm ref:ours
unit-center-container.tscn --2d` differs at a mean channel error of 0.01/255
over the 1152x648 frame — all of it on the centred label's glyph edges.

## Linting

<!-- lint:begin CenterContainer -->
Strict parsing format-checks the inherited set (35 inherited from Control); `CenterContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
<!-- lint:end -->

CenterContainer's parser is a pure passthrough to `parseControl`: it adds no
property and no fallback of its own, so its lenient-parsing behavior is
entirely Control's.
