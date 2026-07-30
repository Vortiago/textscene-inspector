---
type: CenterContainer
category: 2D
fixture: unit-center-container.tscn
image: unit-center-container
renders_as: a centering flex container
---

# CenterContainer

CenterContainer places its single child at the exact center of its own rect,
horizontally and vertically. The previewer maps it to a CSS flexbox centered on
both axes, so the container draws nothing itself — only the centered child shows.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | fills the parent Control (full rect), so the container's center is the viewport center |
| `anchor_right` / `anchor_bottom` | `1.0` | the container spans the full viewport width and height |
| child `Label.text` | `"Centered"` | the single child; the container pins it dead-center |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin CenterContainer -->
Strict parsing format-checks the inherited set (33 inherited from Control); `CenterContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

CenterContainer's parser is a pure passthrough to `parseControl`: it adds no
property and no fallback of its own, so its lenient-parsing behavior is
entirely Control's.
