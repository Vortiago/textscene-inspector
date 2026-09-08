---
type: FlowContainer
category: 2D
status: unimplemented
fixture: unit-flow-container.tscn
# image: unit-flow-container
renders_as: an invisible transform-only fallback
---

# FlowContainer

The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `alignment` | `1` (`ALIGNMENT_CENTER`) | Format-checked only; the previewer draws nothing regardless. |
| `last_wrap_alignment` | `3` (`LAST_WRAP_ALIGNMENT_END`) | Format-checked only. |
| `vertical` | `true` | Format-checked only. |
| `reverse_fill` | `true` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin FlowContainer -->
Strict parsing format-checks these `FlowContainer` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `alignment` | enum 0-2 (ALIGNMENT_BEGIN/ALIGNMENT_CENTER/ALIGNMENT_END) | warning |
| `last_wrap_alignment` | enum 0-3 (LAST_WRAP_ALIGNMENT_INHERIT/LAST_WRAP_ALIGNMENT_BEGIN/LAST_WRAP_ALIGNMENT_CENTER/LAST_WRAP_ALIGNMENT_END) | warning |
| `reverse_fill` | true or false |  |
| `vertical` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`linterParser.ts` format-checks all 4 of FlowContainer's own members
(`doc/classes/FlowContainer.xml`, none of them `overrides=`). None affect the
rendered fallback today, since FlowContainer draws nothing itself (ADR-0003):
the strict and lenient parsers still agree on every property, because
the registered base parser reads none of these keys at all — it reuses `parseControl`
unchanged. `vertical` stays validated at this level even though
`HFlowContainer`/`VFlowContainer` (a later wave) hide it from their own
inspector: `_validate_property` only applies `PROPERTY_USAGE_NONE` to it when
the C++ `is_fixed` flag is set, and a plain `FlowContainer` leaves that flag
false, so its scene files keep writing `vertical` like any other property.
