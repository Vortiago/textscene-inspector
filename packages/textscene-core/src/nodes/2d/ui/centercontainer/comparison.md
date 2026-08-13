---
type: CenterContainer
category: 2D
status: unreviewed
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
Strict parsing format-checks these `CenterContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `use_top_left` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

The block above predates this section and still reads "`CenterContainer`
declares none of its own"; it is the generated `lint:begin`/`lint:end` block
and is now stale, needing a regen once that can run without racing concurrent
slice work.

`CenterContainer` does have one own member: `use_top_left`
(doc/classes/CenterContainer.xml, `center_container.cpp:94`). It now has a
strict validator (`linterParser.ts`, `v.boolean`): `set_use_top_left`
(center_container.cpp:50-58) assigns straight through with no ERR_FAIL, no
clamp and no hinted range, so a malformed literal is the only failure and it
is always an error (ADR-0032).

CenterContainer's parser is a pure passthrough to `parseControl`: it adds no
property and no fallback of its own, so its lenient-parsing behavior is
entirely Control's. That includes `use_top_left`: `parser.ts` never reads it
(there is no field for it on `ControlProperties`), and `Component.tsx` always
lays the child out with `alignItems: 'center', justifyContent: 'center'` with
no branch for the alternate anchor. Godot's `use_top_left = true` centers the
child around the container's top-left corner instead of its own center
(`center_container.cpp:83`); the previewer has no equivalent for that mode, so
the property is validated but has no effect on the render.
