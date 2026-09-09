---
type: BoxContainer
category: 2D
status: unimplemented
fixture: unit-box-container.tscn
# image: unit-box-container
renders_as: invisible transform-only fallback
---

# BoxContainer

BoxContainer is the abstract base that stacks children along one axis, behind
HBoxContainer and VBoxContainer. The previewer parses and validates it but does not draw
it, so it renders as a transform-only fallback and its children still show.

## Linting

<!-- lint:begin BoxContainer -->
Strict parsing format-checks these `BoxContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

`index.ts` reuses `parseControl` unchanged, which reads neither `alignment` nor
`vertical`, so a bad value is never read. `vertical` is still validated here, since a
plain BoxContainer serialises it where its fixed-axis subclasses hide it.

## Known limitations

- **Not drawn** Godot stacks the children along the chosen axis. The previewer applies
  no layout, so they stay at their authored offsets.
